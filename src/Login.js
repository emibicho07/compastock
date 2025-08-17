import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import './Login.css';

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('restaurante');
  const [restaurant, setRestaurant] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // ---------- LOGIN (con verificación de email) ----------
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Refresca user y token para traer emailVerified actualizado
        await user.reload();
        await user.getIdToken(true);

        if (!user.emailVerified) {
          const wantsResend = window.confirm(
            'Tu correo aún no está verificado.\n\n¿Quieres que te reenviemos el correo de verificación?'
          );
          if (wantsResend) {
            await sendEmailVerification(user);
            alert(`Te reenviamos el correo de verificación a ${user.email}. Revisa tu bandeja o spam.`);
          }
          await signOut(auth);
          setError('Debes verificar tu correo antes de continuar.');
          setLoading(false);
          return;
        }

        // Cargar datos del usuario en Firestore (doc: users/{uid})
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userSnap.exists()) {
          await signOut(auth);
          setError('No se encontraron datos del usuario en la base de datos.');
          setLoading(false);
          return;
        }

        const userData = userSnap.data();
        onLogin({ uid: user.uid, email: user.email, ...userData });
      } else {
        // ---------- REGISTRO ----------
        // 1) Validar código (lectura puntual permitida si used == false)
        const code = organizationCode.trim().toLowerCase();
        if (!code) {
          setError('Debes ingresar un código de organización.');
          setLoading(false);
          return;
        }

        const codeRef = doc(db, 'organizationCodes', code);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists()) {
          setError('❌ El código de organización no existe.');
          setLoading(false);
          return;
        }
        if (codeSnap.data().used !== false) {
          setError('❌ Este código ya fue utilizado.');
          setLoading(false);
          return;
        }

        // 2) Crear cuenta de Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3) Guardar doc de usuario en Firestore (users/{uid})
        const userData = {
          uid: user.uid,
          name,
          email,
          role,
          restaurant: role === 'restaurante' ? restaurant : null,
          organizationId: code,
          organizationName: codeSnap.data().organizationName || code,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', user.uid), userData);

        // 4) Marcar el código como usado
        await updateDoc(codeRef, {
          used: true,
          usedBy: user.uid,
          usedAt: new Date().toISOString(),
        });

        // 5) Enviar verificación por email
        await sendEmailVerification(auth.currentUser);
        alert(`Te enviamos un correo de verificación a ${user.email}. Verifícalo para continuar.`);

        // 6) Notificar a la app (el EmailVerificationGate bloqueará vistas hasta que verifique)
        onLogin({ uid: user.uid, email: user.email, ...userData });
      }
    } catch (error) {
      // Manejo de errores más claros
      if (error.code === 'auth/user-not-found') {
        setError('Usuario no encontrado. Verifica tu email.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta.');
      } else if (error.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado.');
      } else if (error.code === 'permission-denied') {
        setError('Permiso denegado por reglas de seguridad. Verifica tu correo o tu organización.');
      } else {
        setError(error.message || 'Ocurrió un error.');
      }
      console.error('[Login] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isLogin ? 'Iniciar Sesión' : 'Registrarse'}</h2>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label>Código de Organización:</label>
                <input
                  type="text"
                  value={organizationCode}
                  onChange={(e) => setOrganizationCode(e.target.value)}
                  placeholder="Ej: restaurante-demo"
                  required
                />
                <small style={{ color: '#666', fontSize: '0.8rem' }}>
                  Pide a tu admin el código de tu organización
                </small>
              </div>

              <div className="form-group">
                <label>Nombre completo:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label>Rol:</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="restaurante">🍴 Restaurante</option>
                  <option value="surtidor">🚚 Surtidor</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>

              {role === 'restaurante' && (
                <div className="form-group">
                  <label>Nombre del restaurante:</label>
                  <input
                    type="text"
                    value={restaurant}
                    onChange={(e) => setRestaurant(e.target.value)}
                    placeholder="Ej: Sucursal Centro"
                    required
                  />
                </div>
              )}
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>
        </form>

        <p className="toggle-mode">
          {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="toggle-button"
          >
            {isLogin ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
