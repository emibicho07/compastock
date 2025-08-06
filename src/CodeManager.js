import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './CodeManager.css';

function CodeManager({ user, onBack }) {
  const [codes, setCodes] = useState([]);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadCodes();
    }
  }, [user]);

  const loadCodes = async () => {
    setLoading(true);
    const snapshot = await getDocs(collection(db, 'organizationCodes'));
    const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setCodes(fetched);
    setLoading(false);
  };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    if (!newCode || !newName) return;

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'organizationCodes', newCode.toLowerCase()), {
        organizationName: newName,
        used: false,
        createdAt: new Date().toISOString()
      });
      setNewCode('');
      setNewName('');
      loadCodes();
      alert('✅ Código creado exitosamente');
    } catch (err) {
      console.error('Error creando código:', err);
      alert('❌ Hubo un error al crear el código');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUsed = async (codeId, currentState) => {
    try {
      await updateDoc(doc(db, 'organizationCodes', codeId), {
        used: !currentState
      });
      loadCodes();
    } catch (err) {
      console.error('Error actualizando código:', err);
    }
  };

  if (user?.role !== 'admin') {
    return <p className="error-message">Acceso denegado</p>;
  }

  return (
    <div className="code-manager-container">
      <div className="cm-header">
        <button className="back-button" onClick={onBack}>← Volver</button>
        <h2>🎟️ Administrador de Códigos</h2>
      </div>

      <form className="code-form" onSubmit={handleCreateCode}>
        <input
          type="text"
          placeholder="ID del Código (sin espacios)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Nombre de la Organización"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear Código'}
        </button>
      </form>

      {loading ? (
        <p>Cargando códigos...</p>
      ) : (
        <div className="code-list">
          {codes.length === 0 ? (
            <p>No hay códigos aún.</p>
          ) : (
            codes.map((code) => (
              <div key={code.id} className={`code-card ${code.used ? 'used' : 'available'}`}>
                <div className="code-main">
                  <strong>{code.id}</strong>
                  <span>{code.organizationName}</span>
                  <small>Creado: {new Date(code.createdAt).toLocaleDateString()}</small>
                </div>
                <div className="code-actions">
                  <span className={`status-tag ${code.used ? 'used' : 'available'}`}>
                    {code.used ? 'Usado' : 'Disponible'}
                  </span>
                  <button onClick={() => toggleUsed(code.id, code.used)}>
                    {code.used ? 'Liberar' : 'Marcar como usado'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default CodeManager;
