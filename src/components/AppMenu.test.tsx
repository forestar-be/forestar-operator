import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppMenu from './AppMenu';

// Les entrées sont des `menuitem` (MUI) ; celles qui sont des liens portent un href.
const links = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .filter((item) => item.hasAttribute('href'));

const open = async () => {
  render(<AppMenu current="operator" />);
  await userEvent.click(screen.getByRole('button', { name: 'Applications' }));
  return screen.getByRole('menu');
};

describe('AppMenu', () => {
  it('affiche le bouton Applications, menu fermé', () => {
    render(<AppMenu current="operator" />);
    expect(
      screen.getByRole('button', { name: 'Applications' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('liste les dix applications sous trois intitulés de groupe', async () => {
    const menu = await open();
    // 9 liens + l'entrée courante = 10 entrées
    expect(links(menu)).toHaveLength(9);
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(10);
    expect(
      within(menu).getByText('Atelier', { selector: 'li' }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByText('Locations', { selector: 'li' }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByText('Ventes et gestion', { selector: 'li' }),
    ).toBeInTheDocument();
  });

  it("ne rend pas l'entrée courante cliquable et la marque", async () => {
    const menu = await open();
    const current = within(menu).getByRole('menuitem', { current: 'page' });
    expect(current).not.toHaveAttribute('href');
    expect(within(current).getByText('Vous êtes ici')).toBeVisible();
    expect(
      within(menu).getAllByRole('menuitem', { current: 'page' }),
    ).toHaveLength(1);
  });

  it('ouvre les autres applications dans un nouvel onglet', async () => {
    const menu = await open();
    for (const link of links(menu)) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    }
  });

  it('se ferme avec Échap', async () => {
    await open();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
