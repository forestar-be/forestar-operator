import '@testing-library/jest-dom';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import DynamicForm from './Form';
import { authorizedFetch } from '../hooks/session';
import { StorageApiError, submitOperatorForm } from '../api/operatorClients';

jest.mock('../styles/Form.css', () => ({}));
jest.mock('../hooks/session', () => ({ authorizedFetch: jest.fn() }));
const auth = { token: 'local-fixture', logOut: jest.fn() };
jest.mock('../hooks/AuthProvider', () => ({ useAuth: () => auth }));
jest.mock('../api/operatorClients', () => ({
  ...jest.requireActual('../api/operatorClients'),
  submitOperatorForm: jest.fn(),
}));
jest.mock('browser-image-compression', () => ({
  __esModule: true,
  default: async (file: File) => file,
}));
jest.mock('./ClientBlock', () => ({
  __esModule: true,
  default: ({ onSelectClient }: any) => (
    <button type="button" onClick={() => onSelectClient({ id: 7 })}>
      Choisir client fixture
    </button>
  ),
}));
jest.mock('react-signature-canvas', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ onEnd }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        toDataURL: () => 'data:fixture',
        clear: jest.fn(),
      }));
      return (
        <button type="button" onClick={onEnd}>
          Signer fixture
        </button>
      );
    }),
  };
});

const fetchMock = authorizedFetch as jest.Mock;
const submitMock = submitOperatorForm as jest.Mock;
const fields = [
  { id: 'machine_type_name', label: 'Type machine', type: 'text' },
  { id: 'robot_pin', label: 'PIN', type: 'text' },
  { id: 'file', label: 'Photo fixture', type: 'file' },
  { id: 'signature', label: 'Signature', type: 'signature' },
];

async function setup(enabled = true) {
  fetchMock.mockImplementation(async (_token, url) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.endsWith('formConfig')
        ? { fields }
        : {
            machineType: ['Robot', 'Tondeuse'],
            robotMachineTypes: ['Robot'],
            storageSettings: { enabled, allowOverflow: true },
          },
  }));
  const view = render(<DynamicForm />);
  await screen.findByLabelText('Type machine');
  return view;
}
async function ready() {
  const view = await setup();
  fireEvent.change(screen.getByLabelText('Type machine'), {
    target: { name: 'machine_type_name', value: 'Robot' },
  });
  fireEvent.click(screen.getByText('Choisir client fixture'));
  fireEvent.click(screen.getByText('Signer fixture'));
  fireEvent.change(screen.getByLabelText('Photo fixture'), {
    target: { files: [new File(['fixture'], 'photo.jpg')] },
  });
  await screen.findByText("Supprimer l'image");
  return view;
}
function send(view: ReturnType<typeof render>) {
  fireEvent.submit(screen.getByRole('form'));
}

beforeEach(() => {
  jest.clearAllMocks();
  submitMock.mockReset();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:fixture',
  });
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => '7078097e-6e25-475e-aa91-a4b57816716e',
  });
});

test('propose un dépôt par défaut seulement pour les types explicitement classés robots', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('Type machine'), {
    target: { name: 'machine_type_name', value: 'Tondeuse' },
  });
  fireEvent.change(screen.getByLabelText('PIN'), {
    target: { name: 'robot_pin', value: '1234' },
  });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Type machine'), {
    target: { name: 'machine_type_name', value: 'Robot' },
  });
  expect(
    screen.getByRole('checkbox', { name: 'Robot déposé à l’atelier' }),
  ).toBeChecked();
});

test('fonction désactivée : aucune proposition de dépôt', async () => {
  await setup(false);
  fireEvent.change(screen.getByLabelText('Type machine'), {
    target: { name: 'machine_type_name', value: 'Robot' },
  });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

test('saturation : confirme explicitement, rejoue le même identifiant et montre le code réservé', async () => {
  submitMock
    .mockRejectedValueOnce(
      new StorageApiError('storage_full_confirmation_required', 'Complet'),
    )
    .mockResolvedValueOnce({
      newRepair: {
        id: 42,
        storageDepositedAt: '2026-10-16',
        storageSlot: {
          id: 1,
          level: 2,
          position: 'B',
          rack: { id: 1, number: 3 },
        },
      },
    });
  const view = await ready();
  send(view);
  const dialog = await screen.findByRole('dialog');
  expect(screen.getByLabelText('Type machine')).toHaveValue('Robot');
  expect(
    submitMock.mock.calls[0][2].get('storage_confirm_overflow'),
  ).toBeNull();
  fireEvent.click(
    within(dialog).getByText('Confirmer le dépôt sans emplacement'),
  );
  await screen.findByText('R3/2/B');
  expect(submitMock).toHaveBeenCalledTimes(2);
  const first = submitMock.mock.calls[0][2] as FormData;
  const second = submitMock.mock.calls[1][2] as FormData;
  expect(second.get('submission_id')).toBe(first.get('submission_id'));
  expect(second.get('storage_confirm_overflow')).toBe('true');
  expect(second.get('storage_deposited')).toBe('true');
  expect(
    screen.getByRole('link', { name: 'Changer de place' }),
  ).toHaveAttribute('href', 'https://atelier.forestar.be/rangement?repair=42');
  expect(fetchMock.mock.calls.every(([, url]) => !url.includes('/print'))).toBe(
    true,
  );
});

test('refus sans débordement : conserve photo, signature, type et dépôt', async () => {
  submitMock.mockRejectedValueOnce(
    new StorageApiError('storage_full', 'Dépôt refusé : complet'),
  );
  const view = await ready();
  send(view);
  await screen.findByText(/Dépôt refusé : complet/);
  expect(screen.getByLabelText('Type machine')).toHaveValue('Robot');
  expect(screen.getByText("Supprimer l'image")).toBeVisible();
  expect(screen.getByRole('checkbox')).toBeChecked();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  submitMock.mockResolvedValueOnce({ newRepair: { id: 43 } });
  send(view);
  await screen.findByText('Fiche n° 43 enregistrée');
  expect(submitMock.mock.calls[1][2].get('signature')).toBe('data:fixture');
});

test('double soumission bloquée et robot non déposé sans emplacement', async () => {
  let resolve!: (result: any) => void;
  submitMock.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = await ready();
  fireEvent.click(screen.getByRole('checkbox'));
  send(view);
  send(view);
  expect(submitMock).toHaveBeenCalledTimes(1);
  expect(submitMock.mock.calls[0][2].get('storage_deposited')).toBe('false');
  resolve({
    newRepair: { id: 44, storageDepositedAt: null, storageSlot: null },
  });
  await screen.findByText('Fiche n° 44 enregistrée');
  expect(screen.queryByText('Emplacement réservé')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Changer de place' }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Imprimer les tickets' }),
    ).toBeEnabled(),
  );
});
