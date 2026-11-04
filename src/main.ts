/**
 * L'ÉTOILE Haute Couture & Fashion Platform
 * Vanilla JavaScript ES6+ Main Entry Point & Router
 */

import { state } from './state';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, limit, query } from 'firebase/firestore';

import { renderHeader, setupHeaderEvents } from './components/Header';
import { renderFooter } from './components/Footer';
import { renderCartDrawer, setupCartDrawerEvents } from './components/CartDrawer';

import { renderHomeView } from './views/HomeView';
import { renderShopView, setupShopEvents } from './views/ShopView';
import { renderProductView, setupProductEvents } from './views/ProductView';
import { renderCartView, setupCartEvents } from './views/CartView';
import { renderCheckoutView, setupCheckoutEvents } from './views/CheckoutView';
import { renderAccountView, setupAccountEvents } from './views/AccountView';
import { renderTrackView, setupTrackEvents } from './views/TrackView';
import { renderPageView } from './views/PageView';
import { renderAdminView, setupAdminEvents } from './admin/AdminView';

const appRoot = document.getElementById('app') || document.body;

// The storefront owns the user's selected theme. Admin is intentionally kept
// light and must not inherit the storefront's dark-mode presentation.
function applyRouteTheme(isAdminRoute: boolean) {
  document.documentElement.dataset.theme = isAdminRoute ? 'light' : state.getTheme();
}

// Router dispatcher
async function handleRouting() {
  const hash = window.location.hash.slice(1) || 'home';
  const [routePath, queryString] = hash.split('?');
  const urlParams = new URLSearchParams(queryString || '');

  // Admin routes check
  if (routePath.startsWith('admin')) {
    applyRouteTheme(true);
    const parts = routePath.split('/');
    const section = parts[1] || 'overview';
    
    appRoot.innerHTML = await renderAdminView(section);
    setupAdminEvents(section);
    window.scrollTo(0, 0);
    return;
  }

  applyRouteTheme(false);

  // Storefront Layout Wrapper
  let mainContentHtml = '';

  if (routePath === 'home' || routePath === '') {
    mainContentHtml = await renderHomeView();
  } else if (routePath === 'shop') {
    mainContentHtml = await renderShopView(urlParams);
  } else if (routePath === 'product') {
    const prodId = urlParams.get('id') || '';
    mainContentHtml = await renderProductView(prodId);
  } else if (routePath === 'cart') {
    mainContentHtml = renderCartView();
  } else if (routePath === 'checkout') {
    mainContentHtml = await renderCheckoutView();
  } else if (routePath === 'account') {
    mainContentHtml = await renderAccountView(urlParams);
  } else if (routePath === 'track') {
    mainContentHtml = await renderTrackView(urlParams);
  } else if (routePath.startsWith('page/')) {
    const slug = routePath.replace('page/', '');
    mainContentHtml = await renderPageView(slug);
  } else {
    mainContentHtml = await renderHomeView();
  }

  // Assemble Complete Layout
  appRoot.innerHTML = `
    ${renderHeader()}
    <main id="main-content">
      ${mainContentHtml}
    </main>
    ${renderFooter()}
    ${renderCartDrawer()}
  `;

  // Attach interactive listeners
  setupHeaderEvents();
  setupCartDrawerEvents();

  if (routePath === 'shop') {
    setupShopEvents();
  } else if (routePath === 'product') {
    const prodId = urlParams.get('id') || '';
    if (prodId) {
      try {
        const snap = await getDoc(doc(db, 'products', prodId));
        if (snap.exists()) {
          setupProductEvents({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error('Failed to load product events', e);
      }
    }
  } else if (routePath === 'cart') {
    setupCartEvents();
  } else if (routePath === 'checkout') {
    setupCheckoutEvents();
  } else if (routePath === 'account') {
    setupAccountEvents();
  } else if (routePath === 'track') {
    setupTrackEvents();
  }

  window.scrollTo(0, 0);
}

// Initial Bootstrapping
async function bootstrapApp() {
  // Listen for Firebase Auth state changes
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isAdmin = user.email?.toLowerCase() === 'muhammedadel.dev@gmail.com';
      state.setCurrentUser(user, isAdmin);
    } else {
      // Retain admin state if stored in session
      if (!state.isAdmin()) {
        state.setCurrentUser(null, false);
      }
    }
  });

  // Load Settings from Firestore
  try {
    const setSnap = await getDoc(doc(db, 'settings', 'store'));
    if (setSnap.exists()) {
      state.setSettings(setSnap.data());
    } else {
      // Auto seed initial luxury fashion products if database is empty
      const prodsCheck = await getDocs(query(collection(db, 'products'), limit(1)));
      if (prodsCheck.empty) {
        console.log('Seeding initial luxury fashion brand catalog...');
        await fetch('/api/seed', { method: 'POST' });
        const freshSet = await getDoc(doc(db, 'settings', 'store'));
        if (freshSet.exists()) {
          state.setSettings(freshSet.data());
        }
      }
    }
  } catch (e) {
    console.warn('Settings fetch warning, using defaults', e);
  }

  // Re-render when state changes (e.g. language switched, item added to bag)
  state.subscribe(() => {
    handleRouting();
  });

  // Listen for URL hash changes
  window.addEventListener('hashchange', () => {
    handleRouting();
  });

  // Initial Route Render
  await handleRouting();
}

bootstrapApp();
