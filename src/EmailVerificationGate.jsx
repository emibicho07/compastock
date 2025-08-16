// src/EmailVerificationGate.jsx
import React, { useState } from 'react';
import { auth } from './firebase';
import { sendEmailVerification } from 'firebase/auth';

export default function EmailVerificationGate({ children }) {
  const [busy, setBusy] = useState(false);
  const user = auth.currentUser;

  // Mientras se resuelve la sesión inicial puedes mostrar un placeholder
  if (!user) return null;

  const handleRefresh = async () => {
    try {
      setBusy(true);
      await auth.currentUser.reload();          // actualiza emailVerified en el objeto user
      await auth.currentUser.getIdToken(true);  // fuerza refresco del ID token (para rules)
      // con esto, si ya verificó, se re-renderiza y pasa el gate
    } finally {
      setBusy(false);
      // Si quieres forzar render global:
      // window.location.reload();
    }
  };

  const resendVerification = async () => {
    try {
      setBusy(true);
      await sendEmailVerification(auth.currentUser);
      alert(`Te enviamos nuevamente el correo de verificación a ${auth.currentUser.email}. Revisa tu bandeja o spam.`);
    } finally {
      setBusy(false);
    }
  };

  if (!user.emailVerified) {
    return (
      <div style={{
        maxWidth: 640, margin: '2rem auto', padding: '1rem 1.25rem',
        background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: 10
      }}>
        <h3 style={{ marginTop: 0 }}>Confirma tu correo</h3>
        <p>
          Enviamos un enlace de verificación a <strong>{user.email}</strong>.
          Debes verificar tu email para acceder a la aplicación.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            onClick={handleRefresh}
            disabled={busy}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#1976d2', color: '#fff' }}
          >
            Ya verifiqué mi correo
          </button>
          <button
            onClick={resendVerification}
            disabled={busy}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #888', background: '#fff' }}
          >
            Reenviar verificación
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#6c757d', marginTop: '0.75rem' }}>
          Consejo: después de verificar, vuelve aquí y presiona “Ya verifiqué mi correo”.
        </p>
      </div>
    );
  }

  // Email verificado → renderiza la app normalmente
  return children;
}
