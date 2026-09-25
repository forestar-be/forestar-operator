import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import {
  ClientConflictApiError,
  searchOperatorClients,
  updateOperatorClient,
  UnauthorizedError,
  type ClientConflictField,
  type ClientFormInput,
  type ClientSearchResult,
  type PublicClient,
} from '../api/operatorClients';

interface FieldConfig {
  id: string;
  label: string;
  type: string;
  isRequired: boolean;
}

interface ClientBlockProps {
  /** Champs du client de `Formulaire Opérateur`, dans leur ordre (AC-01). */
  fields: FieldConfig[];
  /** Rend un champ exactement comme le reste du formulaire (mêmes libellés). */
  renderField: (field: FieldConfig) => React.ReactNode;
  selectedClient: PublicClient | null;
  onSelectClient: (client: PublicClient | null) => void;
  apiUrl: string;
  token: string;
  onUnauthorized: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function clientLabel(client: PublicClient): string {
  return `${client.firstName} ${client.lastName}`.trim() || `Client n° ${client.id}`;
}

/** Coordonnées d'un client, sous les ids du formulaire (pour préremplir l'édition). */
function clientToFormInput(client: PublicClient): ClientFormInput {
  return {
    last_name: client.lastName,
    first_name: client.firstName,
    address: client.address,
    postal_code: client.postalCode,
    city: client.city,
    phone: client.phone,
    email: client.email,
  };
}

/**
 * R008-S02 — Bloc Client en tête du formulaire : recherche d'un client
 * existant (AC-02), ou saisie d'un nouveau client (les champs de
 * `Formulaire Opérateur`). Un client choisi s'affiche en lecture, avec
 * « Changer de client » et « Modifier » : décision du PO du 2026-09-25, qui
 * remplace D-22 (« la tablette ne modifie jamais un client existant ») —
 * l'opérateur voit et peut corriger les coordonnées du client choisi. La
 * modification vaut pour toutes les fiches du client (D-19).
 */
const ClientBlock: React.FC<ClientBlockProps> = ({
  fields,
  renderField,
  selectedClient,
  onSelectClient,
  apiUrl,
  token,
  onUnauthorized,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Édition du client choisi (décision du PO du 2026-09-25, remplace D-22).
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<ClientFormInput>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState<{
    field: ClientConflictField;
    client: PublicClient;
  } | null>(null);

  // AC-06 — la remise à zéro du formulaire vide `selectedClient` depuis le
  // parent (sans passer par « Changer de client ») : la recherche revient
  // aussi à vide, plutôt que de garder d'anciens résultats affichés.
  useEffect(() => {
    if (!selectedClient) {
      setQuery('');
      setResults([]);
      setSearchError(null);
      setEditing(false);
      setSaveError(null);
      setSaveConflict(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchOperatorClients(apiUrl, token, trimmed, onUnauthorized)
        .then((found) => {
          if (!cancelled) {
            setResults(found);
            setSearchError(null);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Erreur lors de la recherche du client:', error);
            setSearchError('Erreur lors de la recherche du client.');
            setResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedClient]);

  const handleChangeClient = () => {
    setQuery('');
    setResults([]);
    setSearchError(null);
    onSelectClient(null);
  };

  const handleStartEdit = () => {
    if (!selectedClient) return;
    setEditValues(clientToFormInput(selectedClient));
    setSaveError(null);
    setSaveConflict(null);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setSaveError(null);
    setSaveConflict(null);
  };

  const handleEditFieldChange = (id: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [id]: value }));
    // Une nouvelle saisie sur le champ en cause efface le conflit affiché.
    if (saveConflict && id === saveConflict.field) setSaveConflict(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedClient) return;
    setSaving(true);
    setSaveError(null);
    setSaveConflict(null);
    try {
      const updated = await updateOperatorClient(
        apiUrl,
        token,
        selectedClient.id,
        editValues,
        onUnauthorized,
      );
      onSelectClient(updated);
      setEditing(false);
    } catch (error) {
      if (error instanceof ClientConflictApiError) {
        setSaveConflict({ field: error.field, client: error.client });
      } else if (error instanceof UnauthorizedError) {
        // `onUnauthorized` a déjà été déclenché par `parseAtelierResponse`.
      } else {
        console.error('Erreur lors de la modification du client:', error);
        setSaveError('Erreur lors de la modification du client.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (selectedClient && editing) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Modifier {clientLabel(selectedClient)}
          </Typography>
          <Grid container spacing={2}>
            {fields.map((field) => (
              <Grid item xs={12} sm={6} key={field.id}>
                <TextField
                  fullWidth
                  label={field.label}
                  value={editValues[field.id as keyof ClientFormInput] ?? ''}
                  onChange={(event) =>
                    handleEditFieldChange(field.id, event.target.value)
                  }
                  disabled={saving}
                  error={saveConflict?.field === field.id}
                  helperText={
                    saveConflict?.field === field.id
                      ? `Un client a déjà ${saveConflict.field === 'phone' ? 'ce téléphone' : 'cet email'} : ${clientLabel(saveConflict.client)}.`
                      : undefined
                  }
                />
              </Grid>
            ))}
          </Grid>
          {saveError && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {saveError}
            </Typography>
          )}
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleSaveEdit}
              disabled={saving}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button variant="outlined" onClick={handleCancelEdit} disabled={saving}>
              Annuler
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (selectedClient) {
    const addressLine = [
      selectedClient.address,
      [selectedClient.postalCode, selectedClient.city].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(' — ');
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {clientLabel(selectedClient)}
          </Typography>
          <Typography variant="body2">
            {selectedClient.phone || 'Téléphone non renseigné'}
          </Typography>
          {selectedClient.email && (
            <Typography variant="body2">{selectedClient.email}</Typography>
          )}
          {addressLine && <Typography variant="body2">{addressLine}</Typography>}
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={handleChangeClient}>
              Changer de client
            </Button>
            <Button variant="outlined" onClick={handleStartEdit}>
              Modifier
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <TextField
        fullWidth
        label="Rechercher un client existant"
        placeholder="Nom, téléphone ou email"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        InputProps={{
          endAdornment: searching ? (
            <CircularProgress size={18} />
          ) : (
            <PersonSearchIcon color="disabled" />
          ),
        }}
      />
      {searchError && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {searchError}
        </Typography>
      )}
      {results.length > 0 && (
        <List
          dense
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            mt: 1,
          }}
        >
          {results.map((client) => (
            <ListItemButton key={client.id} onClick={() => onSelectClient(client)}>
              <ListItemText
                primary={clientLabel(client)}
                secondary={[
                  client.phone || 'Sans téléphone',
                  client.city || null,
                  `${client.repairCount} passage${client.repairCount > 1 ? 's' : ''}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </ListItemButton>
          ))}
        </List>
      )}
      {results.length === 0 &&
        !searching &&
        !searchError &&
        query.trim().length >= MIN_QUERY_LENGTH && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Aucun client trouvé.
          </Typography>
        )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
        Ou saisissez un nouveau client :
      </Typography>
      <Grid container spacing={2}>
        {fields.map((field) => (
          <Grid item xs={12} sm={6} key={field.id}>
            {renderField(field)}
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ClientBlock;
