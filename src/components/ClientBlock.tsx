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
  searchOperatorClients,
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

/**
 * R008-S02 — Bloc Client en tête du formulaire : recherche d'un client
 * existant (AC-02), ou saisie d'un nouveau client (les champs de
 * `Formulaire Opérateur`). Un client choisi s'affiche en lecture, avec
 * « Changer de client » : la tablette ne le modifie jamais (D-22).
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

  // AC-06 — la remise à zéro du formulaire vide `selectedClient` depuis le
  // parent (sans passer par « Changer de client ») : la recherche revient
  // aussi à vide, plutôt que de garder d'anciens résultats affichés.
  useEffect(() => {
    if (!selectedClient) {
      setQuery('');
      setResults([]);
      setSearchError(null);
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
          <Button sx={{ mt: 2 }} variant="outlined" onClick={handleChangeClient}>
            Changer de client
          </Button>
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
