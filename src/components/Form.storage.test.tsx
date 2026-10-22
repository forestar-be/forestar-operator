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
import {
  OperatorHttpError,
  StorageApiError,
  submitOperatorForm,
} from '../api/operatorClients';

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
  default: ({ onSelectClient, fields, renderField }: any) => (
    <>
      {fields.map(renderField)}
      <button type="button" onClick={() => onSelectClient({ id: 7 })}>
        Choisir client fixture
      </button>
    </>
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
  { id: 'first_name', label: 'Prénom fixture', type: 'text' },
  { id: 'last_name', label: 'Nom fixture', type: 'text' },
  { id: 'phone', label: 'Téléphone fixture', type: 'text' },
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
  let uuid = 0;
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => `7078097e-6e25-475e-aa91-${String(++uuid).padStart(12, '0')}`,
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
  ).toHaveAttribute('href', 'https://atelier.forestar.be/rangement?fiche=42');
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

test('API : les deux refus de saturation sont décodés en erreurs métier', async () => {
  const actual = jest.requireActual<typeof import('../api/operatorClients')>(
    '../api/operatorClients',
  );
  for (const code of ['storage_full_confirmation_required', 'storage_full']) {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code, message: 'Complet' }),
    });
    await expect(
      actual.submitOperatorForm('', auth.token, new FormData(), auth.logOut),
    ).rejects.toMatchObject({ code, message: 'Complet' });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code }),
    });
    await expect(
      actual.submitOperatorForm('', auth.token, new FormData(), auth.logOut),
    ).rejects.toBeInstanceOf(StorageApiError);
  }
});

test('impression refusée : garde la réservation et ne recrée jamais le ticket', async () => {
  submitMock.mockResolvedValueOnce({
    newRepair: {
      id: 45,
      storageDepositedAt: '2026-10-16',
      storageSlot: {
        id: 1,
        level: 1,
        position: 'A',
        rack: { id: 1, number: 1 },
      },
    },
  });
  const view = await ready();
  send(view);
  await screen.findByText('R1/1/A');
  fetchMock.mockResolvedValueOnce({
    status: 502,
    json: async () => ({ code: 'print_failed', detail: 'fixture hors ligne' }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Imprimer les tickets' }));
  await screen.findByText(/fixture hors ligne/);
  expect(screen.getByText('R1/1/A')).toBeVisible();
  expect(submitMock).toHaveBeenCalledTimes(1);
  expect(
    fetchMock.mock.calls.filter(([, url]) => url.includes('/print')),
  ).toHaveLength(1);
});

test('le débordement peut être annulé sans création puis confirmé sans place', async () => {
  submitMock
    .mockRejectedValueOnce(
      new StorageApiError('storage_full_confirmation_required', 'Complet'),
    )
    .mockRejectedValueOnce(
      new StorageApiError('storage_full_confirmation_required', 'Complet'),
    )
    .mockResolvedValueOnce({
      newRepair: {
        id: 46,
        storageDepositedAt: '2026-10-16',
        storageSlot: null,
      },
    });
  const view = await ready();
  send(view);
  fireEvent.click(await screen.findByText('Revenir au formulaire'));
  expect(submitMock).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole('checkbox')).toBeChecked();
  send(view);
  fireEvent.click(
    await screen.findByText('Confirmer le dépôt sans emplacement'),
  );
  await screen.findByText(
    'Robot déposé sans emplacement. À ranger dans Atelier.',
  );
  expect(screen.queryByText('Emplacement réservé')).not.toBeInTheDocument();
  const payloads = submitMock.mock.calls.map((call) => call[2] as FormData);
  expect(
    new Set(payloads.map((payload) => payload.get('submission_id'))).size,
  ).toBe(1);
});

test('réponse perdue : rejoue le dépôt du nouveau client sans refaire son contrôle ni modifier la commande', async () => {
  await setup();
  for (const [label, name, value] of [
    ['Prénom fixture', 'first_name', 'Client'],
    ['Nom fixture', 'last_name', 'Revue'],
    ['Téléphone fixture', 'phone', '0499999988'],
    ['Type machine', 'machine_type_name', 'Robot'],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { name, value } });
  fireEvent.click(screen.getByText('Signer fixture'));
  fireEvent.change(screen.getByLabelText('Photo fixture'), {
    target: { files: [new File(['fixture'], 'photo.jpg')] },
  });
  await screen.findByText("Supprimer l'image");
  const client = {
    id: 7,
    firstName: 'Client',
    lastName: 'Revue',
    phone: '0499999988',
  };
  let checks = 0;
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () =>
      ++checks === 1
        ? { conflicts: [], similar: [] }
        : { conflicts: [{ field: 'phone', client }], similar: [] },
  }));
  submitMock
    .mockRejectedValueOnce(new Error('Réponse perdue après commit'))
    .mockResolvedValueOnce({ newRepair: { id: 47 } });
  fireEvent.submit(screen.getByRole('form'));
  const retry = await screen.findByRole('button', {
    name: 'Réessayer cet envoi',
  });
  expect(screen.getByRole('button', { name: 'Nouveau' })).toBeDisabled();
  expect(screen.getByLabelText('Prénom fixture')).toBeDisabled();
  const first = submitMock.mock.calls[0][2] as FormData;
  expect(first.get('client_id')).toBeNull();
  fireEvent.click(retry);
  fireEvent.click(retry);
  await screen.findByText('Fiche n° 47 enregistrée');
  expect(checks).toBe(1);
  expect(submitMock).toHaveBeenCalledTimes(2);
  expect(submitMock.mock.calls[1][2]).toBe(first);
  expect(
    screen.queryByRole('button', { name: 'Utiliser ce client' }),
  ).not.toBeInTheDocument();
});

test('réponse perdue après confirmation de saturation : conserve aussi la confirmation dans le rejeu', async () => {
  submitMock
    .mockRejectedValueOnce(
      new StorageApiError('storage_full_confirmation_required', 'Complet'),
    )
    .mockRejectedValueOnce(new OperatorHttpError(502, 'Réponse perdue'))
    .mockResolvedValueOnce({
      newRepair: {
        id: 48,
        storageDepositedAt: '2026-10-17',
        storageSlot: null,
      },
    });
  const view = await ready();
  send(view);
  fireEvent.click(
    await screen.findByText('Confirmer le dépôt sans emplacement'),
  );
  const retry = await screen.findByRole('button', {
    name: 'Réessayer cet envoi',
  });
  const confirmed = submitMock.mock.calls[1][2] as FormData;
  expect(confirmed.get('storage_confirm_overflow')).toBe('true');
  fireEvent.click(retry);
  await screen.findByText('Fiche n° 48 enregistrée');
  expect(submitMock.mock.calls[2][2]).toBe(confirmed);
  expect(submitMock.mock.calls[0][2].get('submission_id')).toBe(
    confirmed.get('submission_id'),
  );
});

test('refus HTTP 400 reçu : autorise la correction sans conserver une commande incertaine', async () => {
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  submitMock
    .mockRejectedValueOnce(new OperatorHttpError(400, 'Champ invalide'))
    .mockResolvedValueOnce({ newRepair: { id: 49 } });
  const view = await ready();
  send(view);
  await waitFor(() => expect(alert).toHaveBeenCalled());
  expect(
    screen.queryByRole('button', { name: 'Réessayer cet envoi' }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('Type machine')).toBeEnabled();
  fireEvent.change(screen.getByLabelText('PIN'), {
    target: { name: 'robot_pin', value: '5678' },
  });
  send(view);
  await screen.findByText('Fiche n° 49 enregistrée');
  expect(submitMock.mock.calls[1][2].get('submission_id')).not.toBe(
    submitMock.mock.calls[0][2].get('submission_id'),
  );
  alert.mockRestore();
  error.mockRestore();
});

test('API : distingue le statut HTTP reçu d’une réponse réseau perdue', async () => {
  const actual = jest.requireActual<typeof import('../api/operatorClients')>(
    '../api/operatorClients',
  );
  for (const status of [400, 408, 502]) {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ message: 'Refus reçu' }),
    });
    await expect(
      actual.submitOperatorForm('', auth.token, new FormData(), auth.logOut),
    ).rejects.toBeInstanceOf(actual.OperatorHttpError);
  }
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
  await expect(
    actual.submitOperatorForm('', auth.token, new FormData(), auth.logOut),
  ).rejects.toBeInstanceOf(actual.UnauthorizedError);
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({
      code: 'client_conflict',
      field: 'phone',
      client: { id: 7 },
      conflicts: [],
    }),
  });
  await expect(
    actual.submitOperatorForm('', auth.token, new FormData(), auth.logOut),
  ).rejects.toBeInstanceOf(actual.ClientConflictApiError);
});
