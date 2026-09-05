import ReactDOM from 'react-dom/client';
import App from './App';

const LEGACY_HOSTNAME = 'operateur.forestar-shop-atelier.be';
const NEW_URL = 'https://operateur.forestar.be';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

if (window.location.hostname === LEGACY_HOSTNAME) {
  root.render(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <h1>Ce site a déménagé</h1>
      <p>
        Cette adresse n'est plus utilisée. Il faut maintenant utiliser{' '}
        <a href={NEW_URL} target="_blank" rel="noopener noreferrer">
          {NEW_URL}
        </a>
        .
      </p>
      <p>
        Merci de mettre à jour vos favoris : cette ancienne adresse sera
        bientôt désactivée.
      </p>
    </div>
  );
} else {
  root.render(<App />);
}
