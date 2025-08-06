import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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
        // Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          onLogin({ uid: user.uid, email: user.email, ...userData });
        }
      } else {
        // Validar código contra Firestore
        const code = organizationCode.trim().toLowerCase();
        const codeRef = doc(db, 'organizationCodes', code);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists()) {
          setError('❌ El código de organización no existe.');
          setLoading(false);
          return;
        }

        if (codeSnap.data().used) {
          setError('❌ Este código ya fue utilizado.');
          setLoading(false);
          return;
        }

        // Registro
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userData = {
          name,
          email,
          role,
          restaurant: role === 'restaurante' ? restaurant : null,
          organizationId: code,
          organizationName: codeSnap.data().organizationName,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', user.uid), userData);

        await updateDoc(codeRef, {
          used: true,
          usedBy: user.uid,
          usedAt: new Date().toISOString()
        });

        onLogin({ uid: user.uid, email: user.email, ...userData });
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        setError('Usuario no encontrado. Verifica tu email.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta.');
      } else if (error.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado.');
      } else {
        setError(error.message);
      }
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
                  placeholder="Ej: tacos-del-norte"
                  required
                />
                <small style={{ color: '#666', fontSize: '0.8rem' }}>
                  Contacta a tu administrador para obtener este código
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
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="toggle-button">
            {isLogin ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
