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
} from '@mui/material';
import '../styles/Form.css';
import { useTheme } from '@mui/material/styles';
import SignatureCanvas from 'react-signature-canvas';
import DeleteIcon from '@mui/icons-material/Delete';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../hooks/AuthProvider';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

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
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [optionsListByName, setOptionsListByName] = useState<
    Record<string, string[]>
  >({});
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch(`${API_URL}/operator/optionsListByName`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        // check if status 401 or 403
        if (response.status === 401 || response.status === 403) {
          auth.logOut();
          return;
        }

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const result: Record<string, string[]> = await response.json();
        setOptionsListByName(result);
      } catch (error) {
        console.error('Error fetching options:', error);
        alert('Erreur lors de la récupération des options');
      }
    };

    const fetchFormConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/operator/formConfig`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

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
  }, []);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
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
      (Object.keys(formData).length > 0 || signatureData || imagePreviewUrl)
    ) {
      if (
        !window.confirm(
          'Le formulaire actuel contient des données. Voulez-vous vraiment créer un nouveau formulaire ?',
        )
      ) {
        return;
      }
    }
    console.debug('Creating new form');
    setFormData({});
    setSignatureData(null);
    setImagePreviewUrl(null);
    signaturePadRef.current?.clear();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!signatureData) {
      alert('La signature est requise');
      return;
    }

    if (!imagePreviewUrl) {
      alert('La photo est requise');
      return;
    }

    const formDataToSend = new FormData();

    for (const key in formData) {
      if (formData.hasOwnProperty(key)) {
        formDataToSend.append(
          key,
          typeof formData[key] === 'string'
            ? encodeURIComponent(formData[key])
            : formData[key],
        );
      }
    }

    if (signatureData) {
      formDataToSend.append('signature', signatureData);
    }

    try {
      setLoadingSubmit(true);
      const response = await fetch(`${API_URL}/operator/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: formDataToSend,
      });

      // check if status 401 or 403
      if (response.status === 401 || response.status === 403) {
        auth.logOut();
        return;
      }

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      console.log('Form data submitted successfully:', result);
      alert('Formulaire envoyé avec succès');
      handleNewForm(true);
    } catch (error) {
      alert("Erreur lors de l'envoi du formulaire");
    } finally {
      setLoadingSubmit(false);
    }
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
            onClick={() => handleNewForm()}
            endIcon={<AddCircleOutlineIcon />}
          >
            Nouveau
          </Button>
        </Box>
      </Container>
      <Container>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {formConfig ? (
              formConfig.fields.map((field: any) => (
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
              ))
            ) : (
              <Grid container justifyContent="center">
                <CircularProgress size={50} color="inherit" />
              </Grid>
            )}
          </Grid>
          <Box mt={4}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loadingSubmit}
            >
              {loadingSubmit ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Envoyer'
              )}
            </Button>
          </Box>
        </Box>
      </Container>

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
              alt="Image Preview"
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
    </Box>
  );
};

export default DynamicForm;
