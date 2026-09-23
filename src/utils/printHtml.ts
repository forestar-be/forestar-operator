/**
 * R004-S03 — colle d'impression des tickets 80 mm (D-11).
 *
 * Injecte le HTML reçu du serveur dans une iframe cachée, attend son
 * chargement puis déclenche `contentWindow.print()`, à la manière du POS
 * Dolibarr (`tpv.js:8709-8870`) : jamais automatique, toujours sur clic.
 * L'iframe est retirée après `afterprint`, ou au bout d'un délai de sécurité
 * si l'événement n'arrive jamais (certains navigateurs embarqués).
 */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      iframe.remove();
      resolve();
    };

    iframe.addEventListener('load', () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.addEventListener('afterprint', cleanup);
      win.focus();
      win.print();
      // Filet de sécurité : certains navigateurs (webview, iOS) n'émettent
      // jamais `afterprint`.
      setTimeout(cleanup, 5000);
    });

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}
