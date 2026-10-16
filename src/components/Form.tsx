import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Grid,
  TextField,
  MenuItem,
  Typography,
  Modal,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import '../styles/Form.css';
import { useTheme } from '@mui/material/styles';
import SignatureCanvas from 'react-signature-canvas';
import DeleteIcon from '@mui/icons-material/Delete';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PrintIcon from '@mui/icons-material/Print';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../hooks/AuthProvider';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { authorizedFetch } from '../hooks/session';
import {
  PRINT_SUCCESS_MESSAGE,
  requestCounterPrint,
} from '../utils/printTickets';
import ClientBlock from './ClientBlock';
import {
  ClientConflictDialog,
  ClientSimilarDialog,
} from './ClientConflictDialogs';
import {
  CLIENT_FIELD_ID_SET,
  checkOperatorClient,
  submitOperatorForm,
  ClientConflictApiError,
  UnauthorizedError,
  StorageApiError,
  type SubmittedRepair,
  type ClientConflictState,
  type ClientConflictField,
  type ClientFormInput,
  type ClientSearchResult,
  type PublicClient,
} from '../api/operatorClients';
import { noAutofillInputProps } from '../utils/noAutofill';

interface Config {
  id: string;
  label: string;
  type: string;
  isRequired: boolean;
  optionsListName?: string;
  options?: string[];
}

interface FormConfig {
  fields: Config[];
}

const signatureCanvaWidth = 300;
// max size input image in MB
const maxSizeMB = 0.05;
const maxWidthOrHeight = 1024;

const API_URL = process.env.REACT_APP_API_URL;

const DynamicForm = () => {
  const theme = useTheme();
  const auth = useAuth();

  const [formData, setFormData] = useState<any>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  // R004-S03 — boîte de confirmation après l'envoi, avec impression des
  // tickets 80 mm. `confirmedRepairId` remplace l'ancien `alert`.
  const [confirmedRepairId, setConfirmedRepairId] = useState<number | null>(
    null,
  );
  const [confirmedRepair, setConfirmedRepair] =
    useState<SubmittedRepair | null>(null);
  const [robotMachineTypes, setRobotMachineTypes] = useState<string[]>([]);
  const [storageSettings, setStorageSettings] = useState({
    enabled: false,
    allowOverflow: true,
  });
  const [storageDeposited, setStorageDeposited] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [overflowRequest, setOverflowRequest] = useState<{
    client: PublicClient | null;
  } | null>(null);
  const submitInFlight = useRef(false);
  const checkInFlight = useRef(false);
  const submission = useRef<{ fingerprint: string; id: string } | null>(null);
  const isStorageRobot =
    storageSettings.enabled &&
    robotMachineTypes.includes(formData.machine_type_name);
  const [printingTickets, setPrintingTickets] = useState(false);
  const [printTicketsError, setPrintTicketsError] = useState<string | null>(
    null,
  );
  const [printTicketsSuccess, setPrintTicketsSuccess] = useState<string | null>(
    null,
  );
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [optionsListByName, setOptionsListByName] = useState<
    Record<string, string[]>
  >({});
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);

  // R008 — bloc Client : client choisi (lecture seule, D-22), fenêtres de
  // conflit et de suggestion (AC-04), et le focus à rendre au champ à
  // corriger. `fieldRefs` garde une référence de chaque champ texte rendu par
  // `renderField`, y compris les champs du client.
  const [selectedClient, setSelectedClient] = useState<PublicClient | null>(
    null,
  );
  const [conflict, setConflict] = useState<ClientConflictState | null>(null);
  const [similarClients, setSimilarClients] = useState<
    ClientSearchResult[] | null
  >(null);
  const [focusFieldId, setFocusFieldId] = useState<string | null>(null);
  const [checkingClient, setCheckingClient] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await authorizedFetch(
          auth.token,
          `${API_URL}/operator/optionsListByName`,
        );

        // check if status 401 or 403
        if (response.status === 401 || response.status === 403) {
          auth.logOut();
          return;
        }

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const result = await response.json();
        const { robotMachineTypes = [], storageSettings, ...lists } = result;
        setOptionsListByName(lists);
        setRobotMachineTypes(robotMachineTypes);
        setStorageSettings(
          storageSettings ?? { enabled: false, allowOverflow: true },
        );
      } catch (error) {
        console.error('Error fetching options:', error);
        alert('Erreur lors de la récupération des options');
      }
    };

    const fetchFormConfig = async () => {
      try {
        const response = await authorizedFetch(
          auth.token,
          `${API_URL}/operator/formConfig`,
        );

        // check if status 401 or 403
        if (response.status === 401 || response.status === 403) {
          auth.logOut();
          return;
        }

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const result: FormConfig = await response.json();
        setFormConfig(result);
      } catch (error) {
        console.error('Error fetching options:', error);
        alert('Erreur lors de la récupération des options');
      }
    };

    fetchOptions();
    fetchFormConfig();
  }, [auth]);

  // R008-AC-04 — après « Corriger le téléphone/l'email », rend le focus au
  // champ en cause (les ids du client valent aussi le nom du champ en
  // conflit : `phone`, `email`).
  useEffect(() => {
    if (!focusFieldId) return;
    const input = fieldRefs.current[focusFieldId];
    if (input) {
      input.focus();
      input.select();
    }
    setFocusFieldId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFieldId]);

  /**
   * Choisit un client (recherche ou fenêtre de conflit/suggestion) : ses
   * coordonnées passent en lecture (AC-03) et toute coordonnée saisie pour un
   * nouveau client est oubliée, pour ne pas la renvoyer par erreur.
   * `null` revient à la recherche (« Changer de client »).
   */
  const selectClient = (client: PublicClient | null) => {
    setSelectedClient(client);
    if (client) {
      setFormData((prev: any) => {
        const next = { ...prev };
        CLIENT_FIELD_ID_SET.forEach((id) => delete next[id]);
        return next;
      });
    }
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    if (name === 'machine_type_name' && value !== formData.machine_type_name)
      setStorageDeposited(true);
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setFormData({
      ...formData,
      [name]: checked,
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, files } = event.target;
    const file = files?.[0];

    if (file) {
      setLoadingImage(true); // Start loadingImage

      try {
        const options = {
          maxSizeMB: maxSizeMB,
          maxWidthOrHeight: maxWidthOrHeight,
          useWebWorker: true,
          fileType: 'image/webp',
        };

        const compressedFile = await imageCompression(file, options);
        const compressedBlob = new Blob([compressedFile], {
          type: 'image/webp',
        });
        const compressedFileObj = new File(
          [compressedBlob],
          `${file.name}.webp`,
          {
            type: 'image/webp',
          },
        );

        const previewUrl = URL.createObjectURL(compressedFileObj);
        setImagePreviewUrl(previewUrl);

        setFormData({
          ...formData,
          [name]: compressedFileObj,
        });
      } catch (error) {
        console.error('Error compressing the image:', error);
      } finally {
        setLoadingImage(false); // Stop loadingImage
      }
    }
  };

  const handleClearSignature = () => {
    signaturePadRef.current?.clear();
    setSignatureData(null);
  };

  const handleDeleteImage = () => {
    setImagePreviewUrl(null);
    setFormData((prevData: any) => ({
      ...prevData,
      file: null,
    }));
  };

  const handleNewForm = (noCheck = false) => {
    if (
      !noCheck &&
      (Object.keys(formData).length > 0 ||
        signatureData ||
        imagePreviewUrl ||
        selectedClient)
    ) {
      if (
        !window.confirm(
          'Le formulaire actuel contient des données. Voulez-vous vraiment créer un nouveau formulaire ?',
        )
      ) {
        return;
      }
    }
    if (submitInFlight.current || checkInFlight.current) return;
    submission.current = null;
    setStorageDeposited(true);
    setStorageError(null);
    setOverflowRequest(null);
    setFormData({});
    setSignatureData(null);
    setImagePreviewUrl(null);
    // R008-AC-06 — la remise à zéro vide aussi le client choisi et toute
    // fenêtre de conflit ou de suggestion restée ouverte.
    setSelectedClient(null);
    setConflict(null);
    setSimilarClients(null);
    setFocusFieldId(null);
    signaturePadRef.current?.clear();
  };

  /** Coordonnées saisies pour un nouveau client, sous les ids du formulaire. */
  const buildClientInputFromFormData = (): ClientFormInput => {
    const input: ClientFormInput = {};
    CLIENT_FIELD_ID_SET.forEach((id) => {
      const value = formData[id];
      if (typeof value === 'string' && value !== '') {
        (input as Record<string, string>)[id] = value;
      }
    });
    return input;
  };

  /**
   * `FormData` de l'envoi : avec un client choisi, `client_id` remplace ses
   * coordonnées (AC-03) — aucune n'est envoyée, même si des restes de saisie
   * traînent encore dans `formData`.
   */
  const buildSubmitFormData = (
    client: PublicClient | null,
    confirmOverflow: boolean,
  ): FormData => {
    const formDataToSend = new FormData();

    for (const key in formData) {
      if (!formData.hasOwnProperty(key)) continue;
      if (client && CLIENT_FIELD_ID_SET.has(key)) continue;
      formDataToSend.append(
        key,
        typeof formData[key] === 'string'
          ? encodeURIComponent(formData[key])
          : formData[key],
      );
    }

    if (client) {
      formDataToSend.append('client_id', String(client.id));
    }

    if (signatureData) {
      formDataToSend.append('signature', signatureData);
    }

    const fingerprint = JSON.stringify({
      formData,
      signatureData,
      imagePreviewUrl,
      clientId: client?.id,
      deposited: isStorageRobot && storageDeposited,
    });
    if (submission.current?.fingerprint !== fingerprint) {
      submission.current = { fingerprint, id: crypto.randomUUID() };
    }
    formDataToSend.append('submission_id', submission.current.id);
    if (storageSettings.enabled) {
      formDataToSend.append(
        'storage_deposited',
        String(isStorageRobot && storageDeposited),
      );
    }
    if (confirmOverflow)
      formDataToSend.append('storage_confirm_overflow', 'true');
    return formDataToSend;
  };

  /**
   * Envoi effectif de la fiche (R008-S01). `client` vaut le client choisi par
   * la recherche ou une fenêtre de conflit/suggestion, ou `null` pour un
   * nouveau client dont le contrôle vient de passer.
   *
   * AC-05 — le serveur refait le contrôle d'unicité : un `409 client_conflict`
   * ici rouvre la même fenêtre de conflit, sans rien perdre (la photo, la
   * signature et les champs restent dans l'état du composant).
   */
  const submitRepair = async (
    client: PublicClient | null,
    confirmOverflow = false,
  ) => {
    if (submitInFlight.current || confirmedRepairId !== null) return;
    submitInFlight.current = true;
    setStorageError(null);
    try {
      setLoadingSubmit(true);
      const formDataToSend = buildSubmitFormData(client, confirmOverflow);
      const result = await submitOperatorForm(
        API_URL ?? '',
        auth.token,
        formDataToSend,
        auth.logOut,
      );
      setPrintTicketsError(null);
      setConfirmedRepair(result.newRepair);
      setConfirmedRepairId(result.newRepair.id);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      if (error instanceof StorageApiError) {
        if (error.code === 'storage_full_confirmation_required') {
          setOverflowRequest({ client });
        } else {
          setStorageError(error.message);
        }
        return;
      }
      if (error instanceof ClientConflictApiError) {
        setConflict({
          field: error.field,
          client: error.client,
          conflicts: error.conflicts,
        });
        return;
      }
      console.error("Erreur lors de l'envoi du formulaire:", error);
      alert("Erreur lors de l'envoi du formulaire");
    } finally {
      submitInFlight.current = false;
      setLoadingSubmit(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      submitInFlight.current ||
      checkInFlight.current ||
      confirmedRepairId !== null
    )
      return;

    if (!signatureData) {
      alert('La signature est requise');
      return;
    }

    if (!imagePreviewUrl) {
      alert('La photo est requise');
      return;
    }

    // AC-03 — un client déjà choisi ne repasse pas par le contrôle : ce n'est
    // pas une création.
    if (selectedClient) {
      await submitRepair(selectedClient);
      return;
    }

    // AC-04 — nouveau client : contrôle des doublons avant l'envoi.
    checkInFlight.current = true;
    setCheckingClient(true);
    let result;
    try {
      result = await checkOperatorClient(
        API_URL ?? '',
        auth.token,
        buildClientInputFromFormData(),
        auth.logOut,
      );
    } catch (error) {
      checkInFlight.current = false;
      setCheckingClient(false);
      if (error instanceof UnauthorizedError) return;
      console.error('Erreur lors du contrôle du client:', error);
      alert('Erreur lors du contrôle du client. Réessayez.');
      return;
    }
    checkInFlight.current = false;
    setCheckingClient(false);

    if (result.conflicts.length > 0) {
      const first = result.conflicts[0];
      setConflict({
        field: first.field,
        client: first.client,
        conflicts: result.conflicts,
      });
      return;
    }
    if (result.similar.length > 0) {
      setSimilarClients(result.similar);
      return;
    }

    await submitRepair(null);
  };

  /** AC-04 — fenêtre de conflit : le client existant remplace la saisie. */
  const handleConflictUseClient = (client: PublicClient) => {
    setConflict(null);
    selectClient(client);
    void submitRepair(client);
  };

  /** AC-04 — fenêtre de conflit : ferme la fenêtre et rend le focus au champ. */
  const handleConflictCorrect = (field: ClientConflictField) => {
    setConflict(null);
    setFocusFieldId(field);
  };

  /** AC-04 — suggestion : le client proposé remplace la saisie. */
  const handleSimilarUseClient = (client: PublicClient) => {
    setSimilarClients(null);
    selectClient(client);
    void submitRepair(client);
  };

  /** AC-04 — suggestion ignorée : la création se poursuit, sans recontrôler. */
  const handleSimilarCreateNew = () => {
    setSimilarClients(null);
    void submitRepair(null);
  };

  // R002-S03 — « Imprimer les tickets » demande à l'API de les imprimer sur la
  // Toshiba du comptoir (impression-comptoir) : plus de dialogue d'impression,
  // plus d'iframe. L'API fabrique elle-même le HTML de la fiche, rien n'est
  // envoyé d'autre que le numéro. Le bouton se réactive à la fin de l'appel, ce
  // qui permet de réessayer sans réencoder la fiche.
  const handlePrintTickets = async () => {
    if (confirmedRepairId === null || printingTickets) return;
    setPrintTicketsError(null);
    setPrintTicketsSuccess(null);
    setPrintingTickets(true);
    try {
      const outcome = await requestCounterPrint(() =>
        authorizedFetch(
          auth.token,
          `${API_URL}/operator/machine-repairs/${confirmedRepairId}/ticket/print`,
          { method: 'POST' },
        ),
      );

      if (outcome.kind === 'logout') {
        auth.logOut();
      } else if (outcome.kind === 'success') {
        setPrintTicketsSuccess(PRINT_SUCCESS_MESSAGE);
      } else {
        setPrintTicketsError(outcome.message);
      }
    } finally {
      setPrintingTickets(false);
    }
  };

  const handleConfirmationClose = () => {
    setConfirmedRepairId(null);
    setConfirmedRepair(null);
    setPrintTicketsError(null);
    setPrintTicketsSuccess(null);
    handleNewForm(true);
  };

  const renderField = (field: any) => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <TextField
            type={field.type}
            key={field.label}
            label={field.label}
            name={field.id}
            required={field.isRequired}
            fullWidth
            onChange={handleChange}
            value={formData[field.id] || ''}
            inputProps={noAutofillInputProps}
            inputRef={(el: HTMLInputElement | null) => {
              fieldRefs.current[field.id] = el;
            }}
          />
        );
      case 'textarea':
        return (
          <TextField
            key={field.label}
            label={field.label}
            name={field.id}
            required={field.isRequired}
            fullWidth
            multiline
            rows={4}
            onChange={handleChange}
            value={formData[field.id] || ''}
          />
        );
      case 'select':
        return (
          <TextField
            key={field.label}
            select
            label={field.label}
            name={field.id}
            required={field.isRequired}
            fullWidth
            onChange={handleChange}
            value={formData[field.id] || ''}
          >
            {(!field.optionsListName
              ? field.options
              : (optionsListByName[field.optionsListName] ?? [])
            ).map((option: string) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        );
      case 'checkbox':
        return (
          <FormControlLabel
            key={field.label}
            label={field.label}
            required={field.isRequired}
            control={
              <Checkbox
                name={field.id}
                onChange={handleCheckboxChange}
                checked={formData[field.id] || false}
              />
            }
          />
        );
      case 'file':
        return (
          <Box key={field.label}>
            <Button
              variant="contained"
              component="label"
              fullWidth
              disabled={loadingImage}
              startIcon={<CameraAltIcon />}
            >
              {loadingImage ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                field.label
              )}
              <input
                type="file"
                aria-label={field.label}
                hidden
                accept="image/*"
                capture="environment"
                name={field.id}
                onChange={handleFileChange}
              />
            </Button>
            {!loadingImage && imagePreviewUrl && (
              <Box mt={2}>
                <Box mt={1}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleDeleteImage}
                    startIcon={<DeleteIcon />}
                    sx={{ mr: 1 }}
                  >
                    Supprimer l'image
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setModalOpen(true)}
                  >
                    Afficher l'image
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        );
      case 'signature':
        return (
          <Box key={field.label}>
            <Typography variant="body1" sx={{ marginBottom: 2 }}>
              {field.label}
            </Typography>
            <Grid container flexDirection={'column'}>
              <Grid item>
                <SignatureCanvas
                  ref={signaturePadRef}
                  penColor="black"
                  canvasProps={{
                    width: signatureCanvaWidth,
                    height: 200,
                    className: 'sigCanvas',
                  }}
                  onEnd={() =>
                    setSignatureData(
                      signaturePadRef.current?.toDataURL() || null,
                    )
                  }
                />
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleClearSignature}
                  fullWidth
                  sx={{ marginTop: 2, width: signatureCanvaWidth }}
                  startIcon={<DeleteIcon />}
                >
                  Supprimer Signature
                </Button>
              </Grid>
            </Grid>
          </Box>
        );
      default:
        return null;
    }
  };

  const handleCloseModal = () => setModalOpen(false);

  return (
    <Box
      sx={{
        paddingTop: 2,
        paddingBottom: 10,
        paddingX: 2,
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Container>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginBottom={4}
        >
          <Typography
            variant="h5"
            align="center"
            fontWeight={700}
            marginTop={theme.spacing(1)}
            gutterBottom
            sx={{
              color: theme.palette.text.primary,
              textTransform: 'uppercase',
            }}
          >
            Formulaire réparation/entretien
          </Typography>
          <Button
            variant="contained"
            color="primary"
            disabled={loadingSubmit || checkingClient}
            onClick={() => handleNewForm()}
            endIcon={<AddCircleOutlineIcon />}
          >
            Nouveau
          </Button>
        </Box>
      </Container>
      <Container>
        <Box
          component="form"
          aria-label="Formulaire réparation/entretien"
          onSubmit={handleSubmit}
        >
          <Box
            component="fieldset"
            disabled={loadingSubmit || checkingClient}
            sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
          >
            <Grid container spacing={3}>
              {formConfig ? (
                <>
                  {/* R008-AC-01 — bloc Client, dans l'ordre et avec les
                    libellés de `Formulaire Opérateur` ; les autres champs
                    sont rendus comme avant. */}
                  <Grid item xs={12}>
                    <ClientBlock
                      fields={formConfig.fields.filter((field: any) =>
                        CLIENT_FIELD_ID_SET.has(field.id),
                      )}
                      renderField={renderField}
                      selectedClient={selectedClient}
                      onSelectClient={selectClient}
                      apiUrl={API_URL ?? ''}
                      token={auth.token}
                      onUnauthorized={auth.logOut}
                    />
                  </Grid>
                  {formConfig.fields
                    .filter((field: any) => !CLIENT_FIELD_ID_SET.has(field.id))
                    .map((field: any) => (
                      <Grid
                        item
                        xs={12}
                        sm={
                          ['textarea', 'signature', 'file'].includes(field.type)
                            ? 12
                            : 6
                        }
                        key={field.label}
                      >
                        {renderField(field)}
                      </Grid>
                    ))}
                </>
              ) : (
                <Grid container justifyContent="center">
                  <CircularProgress size={50} color="inherit" />
                </Grid>
              )}
            </Grid>
            {isStorageRobot ? (
              <Box mt={3}>
                <FormControlLabel
                  label="Robot déposé à l’atelier"
                  control={
                    <Checkbox
                      checked={storageDeposited}
                      onChange={(event) =>
                        setStorageDeposited(event.target.checked)
                      }
                    />
                  }
                />
                {!storageDeposited ? (
                  <Typography variant="body2">
                    Aucun emplacement ne sera réservé. L’étiquette ne portera
                    pas d’emplacement.
                  </Typography>
                ) : null}
              </Box>
            ) : null}
            {storageError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {storageError} Votre saisie est conservée.
              </Alert>
            ) : null}
            <Box mt={4}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loadingSubmit || checkingClient}
              >
                {loadingSubmit || checkingClient ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Envoyer'
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* R008-AC-04 — conflit bloquant et suggestion non bloquante */}
      <ClientConflictDialog
        conflict={conflict}
        onUseClient={handleConflictUseClient}
        onCorrect={handleConflictCorrect}
      />
      <ClientSimilarDialog
        clients={similarClients}
        onUseClient={handleSimilarUseClient}
        onCreateNew={handleSimilarCreateNew}
      />

      <Dialog
        open={overflowRequest !== null}
        onClose={() => setOverflowRequest(null)}
      >
        <DialogTitle>Tous les emplacements sont occupés</DialogTitle>
        <DialogContent>
          Enregistrer ce robot déposé sans emplacement ? Il apparaîtra dans les
          robots à ranger dans Atelier. Votre saisie est conservée.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverflowRequest(null)}>
            Revenir au formulaire
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!overflowRequest) return;
              const { client } = overflowRequest;
              setOverflowRequest(null);
              void submitRepair(client, true);
            }}
          >
            Confirmer le dépôt sans emplacement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal for showing image */}
      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxWidth: 600,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography variant="h6" component="h2" gutterBottom>
            Image Prise
          </Typography>
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt="Aperçu de la prise"
              style={{
                width: '100%',
                maxHeight: '400px',
                objectFit: 'contain',
              }}
            />
          )}
          <Button onClick={handleCloseModal} color="primary" sx={{ mt: 2 }}>
            Fermer
          </Button>
        </Box>
      </Modal>

      {/* R004-S03 — confirmation d'envoi, avec impression des tickets 80 mm */}
      <Dialog open={confirmedRepairId !== null} disableEscapeKeyDown>
        <DialogTitle>Fiche n° {confirmedRepairId} enregistrée</DialogTitle>
        <DialogContent>
          {confirmedRepair?.storageSlot ? (
            <Box sx={{ mb: 2 }}>
              <Typography>Emplacement réservé</Typography>
              <Typography variant="h3" component="p" fontWeight={700}>
                R{confirmedRepair.storageSlot.rack.number}/
                {confirmedRepair.storageSlot.level}/
                {confirmedRepair.storageSlot.position}
              </Typography>
            </Box>
          ) : confirmedRepair?.storageDepositedAt ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Robot déposé sans emplacement. À ranger dans Atelier.
            </Alert>
          ) : null}
          {confirmedRepair?.storageDepositedAt ? (
            <Button
              href={`https://atelier.forestar.be/rangement?repair=${confirmedRepairId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Changer de place
            </Button>
          ) : null}
          {printTicketsSuccess && (
            <Typography role="status" color="success.main" sx={{ mt: 1 }}>
              {printTicketsSuccess}
            </Typography>
          )}
          {printTicketsError && (
            <Typography role="alert" color="error" sx={{ mt: 1 }}>
              {printTicketsError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={
              printingTickets ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PrintIcon />
              )
            }
            onClick={() => void handlePrintTickets()}
            disabled={printingTickets}
          >
            Imprimer les tickets
          </Button>
          <Button onClick={handleConfirmationClose}>Nouveau formulaire</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DynamicForm;
