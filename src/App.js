// App.jsx (versión corregida)
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './Login';
import ProductManagement from './ProductManagement';
import RestaurantOrders from './RestaurantOrders';
import SupplierDashboard from './SupplierDashboard';
import AdminOverview from './AdminOverview';
import UserManagement from './UserManagement';
import OrganizationSettings from './OrganizationSettings';
import ProviderManagement from './ProviderManagement';
import InventoryControl from './InventoryControl';
import EmailVerificationGate from './EmailVerificationGate';
import './App.css';

// ↓ Puedes ponerlo en true cuando verifiques que tu sw.js está actualizado y sirviendo bien
const ENABLE_SW = false;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Carga robusta de usuario Firestore (por UID + reintento)
  const loadCompleteUserData = async (firebaseUser, tries = 2) => {
    try {
      const ref = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          firestoreId: snap.id,
          ...snap.data(),
        };
      }
      if (tries > 0) {
        await new Promise((r) => setTimeout(r, 400));
        return await loadCompleteUserData(firebaseUser, tries - 1);
      }
      console.error('[USER] No existe /users/{uid} tras reintento');
      return null;
    } catch (err) {
      console.error('[USER] Error leyendo /users/{uid}:', err);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const completeUserData = await loadCompleteUserData(firebaseUser);
          if (completeUserData) {
            setUser(completeUserData);
          } else {
            await signOut(auth);
            setUser(null);
            alert('Error al cargar datos del usuario. Por favor, inicia sesión nuevamente.');
          }
        } catch (error) {
          console.error('Error en autenticación:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // PWA: Verificar conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA: Registrar Service Worker (desactivado por defecto para evitar 404 por SW obsoleto)
  useEffect(() => {
    if (!ENABLE_SW) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration.scope);
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                if (window.confirm('Nueva versión de CompaStock disponible. ¿Actualizar ahora?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch((error) => {
          console.log('Error registrando Service Worker:', error);
        });
    }
  }, []);

  // PWA: Capturar evento de instalación
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      console.log('CompaStock instalado exitosamente');
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // PWA: Manejar acciones desde shortcuts del manifest
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action && user) {
      switch (action) {
        case 'create-order':
          handleNavigation('restaurant-orders', { initialView: 'create', initialUrgent: false });
          break;
        case 'urgent-order':
          handleNavigation('restaurant-orders', { initialView: 'create', initialUrgent: true });
          break;
        case 'supplier-dashboard':
          handleNavigation('supplier-dashboard', { initialView: 'providers' });
          break;
        default:
          break;
      }
    }
  }, [user]);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setCurrentView('dashboard');
      setViewParams({});
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleNavigation = (view, params = {}) => {
    setCurrentView(view);
    setViewParams(params);
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') console.log('Usuario aceptó instalar CompaStock');
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  // 🔒 Normaliza el rol para evitar mismatches (Admin vs admin vs administrador)
  const normalizedRole = (user?.role ?? '').toString().trim().toLowerCase();
  // Debug útil
  console.log('Role original:', user?.role, '→ normalizado:', normalizedRole);
  console.log('Current view:', currentView);

  const renderContent = () => {
    // Vistas navegadas directamente
    if (currentView === 'products') {
      return <ProductManagement user={user} onBack={() => setCurrentView('dashboard')} />;
    }
    if (currentView === 'inventory-control') {
      return <InventoryControl user={user} onBack={() => setCurrentView('dashboard')} />;
    }
    if (currentView === 'restaurant-orders') {
      return (
        <RestaurantOrders
          key={`${viewParams.initialView}-${viewParams.initialUrgent}`}
          user={user}
          onBack={() => setCurrentView('dashboard')}
          initialView={viewParams.initialView}
          initialUrgent={viewParams.initialUrgent}
        />
      );
    }
    if (currentView === 'supplier-dashboard') {
      return (
        <SupplierDashboard
          key={viewParams.initialView}
          user={user}
          onBack={() => setCurrentView('dashboard')}
          initialView={viewParams.initialView}
        />
      );
    }
    if (currentView === 'admin-overview') {
      return <AdminOverview user={user} onBack={() => setCurrentView('dashboard')} handleNavigation={handleNavigation} />;
    }
    if (currentView === 'user-management') {
      return <UserManagement user={user} onBack={() => setCurrentView('dashboard')} />;
    }
    if (currentView === 'organization-settings') {
      return <OrganizationSettings user={user} onBack={() => setCurrentView('dashboard')} />;
    }
    if (currentView === 'provider-management') {
      return <ProviderManagement user={user} onBack={() => setCurrentView('dashboard')} />;
    }

    // Dashboards por rol
    switch (normalizedRole) {
      case 'restaurante':
        return (
          <div className="dashboard">
            <h2>🍴 Dashboard Restaurante</h2>
            <p>Bienvenido, <strong>{user.name}</strong></p>
            <p>Restaurante: <strong>{user.restaurant}</strong></p>
            <p>Organización: <strong>{user.organizationName}</strong></p>
            <div className="dashboard-options">
              <button
                className="dashboard-button"
                onClick={() => handleNavigation('restaurant-orders', { initialView: 'create', initialUrgent: false })}
              >
                📝 Crear Pedido Semanal
              </button>
              <button className="dashboard-button" onClick={() => handleNavigation('inventory-control')}>
                📊 Ver Inventario
              </button>
              <button
                className="dashboard-button urgent-button"
                onClick={() => handleNavigation('restaurant-orders', { initialView: 'create', initialUrgent: true })}
              >
                🚨 Pedido Urgente
              </button>
              <button
                className="dashboard-button"
                onClick={() => handleNavigation('restaurant-orders', { initialView: 'history' })}
              >
                📋 Ver Mis Pedidos
              </button>
              <button
                className="dashboard-button"
                onClick={() => handleNavigation('restaurant-orders', { initialView: 'history' })}
              >
                📊 Historial
              </button>
            </div>
          </div>
        );

      case 'surtidor':
        return (
          <div className="dashboard">
            <h2>🚚 Dashboard Surtidor</h2>
            <p>Bienvenido, <strong>{user.name}</strong></p>
            <p>Organización: <strong>{user.organizationName}</strong></p>
            <div className="dashboard-options">
              <button
                className="dashboard-button"
                onClick={() => handleNavigation('supplier-dashboard', { initialView: 'providers' })}
              >
                🏪 Ver por Proveedores
              </button>
              <button
                className="dashboard-button urgent-button"
                onClick={() => handleNavigation('supplier-dashboard', { initialView: 'urgent' })}
              >
                🚨 Pedidos Urgentes
              </button>
              <button
                className="dashboard-button"
                onClick={() => handleNavigation('supplier-dashboard', { initialView: 'pending' })}
              >
                ⏳ Productos Pendientes
              </button>
              <button
                className="dashboard-button"
                onClick={() => handleNavigation('supplier-dashboard', { initialView: 'providers' })}
              >
                ✅ Marcar Entregas
              </button>
              <button className="dashboard-button" onClick={() => handleNavigation('provider-management')}>
                🏪 Gestionar Proveedores
              </button>
            </div>
          </div>
        );

      case 'admin':
      case 'administrador':
        return (
          <div className="dashboard">
            <h2>👑 Dashboard Administrador</h2>
            <p>Bienvenido, <strong>{user.name}</strong></p>
            <p>Organización: <strong>{user.organizationName}</strong></p>
            <div className="dashboard-options">
              <button className="dashboard-button" onClick={() => handleNavigation('admin-overview')}>
                📊 Vista General
              </button>
              <button className="dashboard-button" onClick={() => handleNavigation('inventory-control')}>
                📊 Gestionar Inventario
              </button>
              <button className="dashboard-button" onClick={() => handleNavigation('products')}>
                📦 Gestionar Productos
              </button>
              <button className="dashboard-button" onClick={() => handleNavigation('user-management')}>
                👥 Gestionar Usuarios
              </button>
              <button className="dashboard-button" onClick={() => handleNavigation('provider-management')}>
                🏪 Gestionar Proveedores
              </button>
              <button className="dashboard-button" onClick={() => handleNavigation('organization-settings')}>
                ⚙️ Configuración
              </button>
            </div>
          </div>
        );

      default:
        return <div>Rol no reconocido: {String(user?.role)}</div>;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando CompaStock...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>CompaStock</h1>
          <div className="header-actions">
            <div className={`connection-indicator ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? '🟢' : '🔴'} {isOnline ? 'En línea' : 'Sin conexión'}
            </div>
            {showInstallPrompt && (
              <button onClick={handleInstallApp} className="install-button">
                📱 Instalar App
              </button>
            )}
            <button onClick={handleLogout} className="logout-button">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {!isOnline && <div className="offline-banner">⚠️ Sin conexión - Algunas funciones pueden no estar disponibles</div>}

      {/* Gate de verificación: bloquea vistas que leen Firestore */}
      <EmailVerificationGate>
        <main className="main-content">{renderContent()}</main>
      </EmailVerificationGate>

      <footer className="app-footer">
        <p>CompaStock v1.0 PWA - Sistema para gestión de inventarios</p>
      </footer>
    </div>
  );
}

export default App;
