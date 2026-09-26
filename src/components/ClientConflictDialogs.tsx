import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import type {
  ClientConflictField,
  ClientConflictState,
  ClientSearchResult,
  PublicClient,
} from '../api/operatorClients';

function clientLabel(client: PublicClient): string {
  return `${client.firstName} ${client.lastName}`.trim() || `Client n° ${client.id}`;
}

interface ClientConflictDialogProps {
  conflict: ClientConflictState | null;
  onUseClient: (client: PublicClient) => void;
  onCorrect: (field: ClientConflictField) => void;
}

/**
 * R008-AC-04 — conflit bloquant : même téléphone ou même email qu'un client
 * existant. Pas d'échappatoire par la touche Échap ou le fond : il faut
 * choisir « Utiliser ce client » ou corriger le champ en cause.
 */
export const ClientConflictDialog: React.FC<ClientConflictDialogProps> = ({
  conflict,
  onUseClient,
  onCorrect,
}) => {
  const fieldLabel = conflict?.field === 'phone' ? 'téléphone' : 'email';
  return (
    <Dialog open={conflict !== null} disableEscapeKeyDown>
      {conflict && (
        <>
          <DialogTitle>Ce {fieldLabel} existe déjà</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Un client a déjà ce {fieldLabel} : <strong>{clientLabel(conflict.client)}</strong>.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => onCorrect(conflict.field)}>
              Corriger {conflict.field === 'phone' ? 'le téléphone' : "l'email"}
            </Button>
            <Button variant="contained" onClick={() => onUseClient(conflict.client)}>
              Utiliser ce client
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

interface ClientSimilarDialogProps {
  clients: ClientSearchResult[] | null;
  onUseClient: (client: PublicClient) => void;
  onCreateNew: () => void;
}

/**
 * R008-AC-04 — suggestion non bloquante sur un nom proche : « Ce client
 * existe peut-être déjà ». Fermer la fenêtre équivaut à créer un nouveau
 * client, comme le bouton dédié.
 */
export const ClientSimilarDialog: React.FC<ClientSimilarDialogProps> = ({
  clients,
  onUseClient,
  onCreateNew,
}) => {
  const list = clients ?? [];
  const first = list[0];
  return (
    <Dialog open={clients !== null} onClose={onCreateNew}>
      <DialogTitle>Ce client existe peut-être déjà</DialogTitle>
      <DialogContent>
        {list.map((client) => (
          <DialogContentText key={client.id} sx={{ mb: 1 }}>
            <strong>{clientLabel(client)}</strong>
            {client.phone ? ` — ${client.phone}` : ''}
            {client.city ? ` — ${client.city}` : ''} — {client.repairCount} passage
            {client.repairCount > 1 ? 's' : ''}
          </DialogContentText>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCreateNew}>Créer un nouveau client</Button>
        <Button
          variant="contained"
          onClick={() => first && onUseClient(first)}
          disabled={!first}
        >
          Utiliser ce client
        </Button>
      </DialogActions>
    </Dialog>
  );
};
