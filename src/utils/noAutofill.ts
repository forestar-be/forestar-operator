/**
 * Attributs d'un champ de recherche ou de coordonnées d'un client : ni le
 * navigateur ni les gestionnaires de mots de passe (1Password, LastPass,
 * Bitwarden, Dashlane) ne doivent y proposer l'adresse ou l'identifiant de la
 * personne qui tient la tablette. `autoComplete="off"` seul ne suffit pas :
 * chaque gestionnaire lit son propre attribut. Se passe à `inputProps` d'un
 * `TextField` MUI.
 */
export const noAutofillInputProps = {
  autoComplete: 'off',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;
