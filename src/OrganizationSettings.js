import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './OrganizationSettings.css';

function OrganizationSettings({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    organizationName: '',
    organizationId: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    city: '',
    country: 'México',
    timezone: 'America/Mexico_City',
    orderFrequency: 'weekly',
    urgentNotifications: true,
    emailNotifications: true,
    autoAssignProviders: false,
    defaultOrderTime: '09:00',
    minimumOrderValue: 0,
    currency: 'MXN'
  });
  const [originalSettings, setOriginalSettings] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Intentar cargar configuración existente
      const settingsDoc = await getDoc(doc(db, 'organizationSettings', user.organizationId));
      
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        setSettings({
          ...settings,
          ...settingsData
        });
        setOriginalSettings(settingsData);
      } else {
        // Configuración inicial basada en el usuario
        const initialSettings = {
          ...settings,
          organizationName: user.organizationName,
          organizationId: user.organizationId,
          contactEmail: user.email
        };
        setSettings(initialSettings);
        setOriginalSettings(initialSettings);
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateDoc(doc(db, 'organizationSettings', user.organizationId), {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name
      });
      
      setOriginalSettings(settings);
      alert('✅ Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      
      // Si el documento no existe, crearlo
      try {
        await setDoc(doc(db, 'organizationSettings', user.organizationId), {
          ...settings,
          createdAt: new Date().toISOString(),
          createdBy: user.name,
          updatedAt: new Date().toISOString(),
          updatedBy: user.name
        });
        
        setOriginalSettings(settings);
        alert('✅ Configuración creada exitosamente');
      } catch (createError) {
        console.error('Error al crear configuración:', createError);
        alert('❌ Error al guardar la configuración');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de que quieres descartar los cambios?')) {
      setSettings(originalSettings);
    }
  };

  const hasChanges = () => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  const generateSubCode = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    const subCode = `${user.organizationId}-${timestamp}${random}`;
    
    if (window.confirm(`¿Generar código adicional para sucursales?\n\nNuevo código: ${subCode}\n\nEsto permitirá registrar usuarios adicionales bajo tu organización.`)) {
      navigator.clipboard.writeText(subCode).then(() => {
        alert(`✅ Código copiado al portapapeles:\n${subCode}\n\nComparte este código con el personal de nuevas sucursales.`);
      });
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="organization-settings">
      <div className="os-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>⚙️ Configuración de la Organización</h2>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {/* Información de la Organización */}
        <div className="settings-section">
          <h3>🏢 Información de la Organización</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Nombre de la organización:</label>
              <input
                type="text"
                value={settings.organizationName}
                onChange={(e) => setSettings({...settings, organizationName: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Código de organización:</label>
              <div className="code-display">
                <span>{settings.organizationId}</span>
                <button 
                  type="button" 
                  onClick={generateSubCode}
                  className="generate-code-btn"
                  title="Generar código adicional para sucursales"
                >
                  + Generar Sub-código
                </button>
              </div>
              <small>Este código es único e inmutable</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email de contacto:</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Teléfono de contacto:</label>
              <input
                type="tel"
                value={settings.contactPhone}
                onChange={(e) => setSettings({...settings, contactPhone: e.target.value})}
                placeholder="Ej: +52 81 1234 5678"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Dirección:</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({...settings, address: e.target.value})}
              placeholder="Calle, número, colonia"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ciudad:</label>
              <input
                type="text"
                value={settings.city}
                onChange={(e) => setSettings({...settings, city: e.target.value})}
                placeholder="Ej: Monterrey"
              />
            </div>
            
            <div className="form-group">
              <label>País:</label>
              <select
                value={settings.country}
                onChange={(e) => setSettings({...settings, country: e.target.value})}
              >
                <option value="México">🇲🇽 México</option>
                <option value="Estados Unidos">🇺🇸 Estados Unidos</option>
                <option value="Colombia">🇨🇴 Colombia</option>
                <option value="Argentina">🇦🇷 Argentina</option>
                <option value="Chile">🇨🇱 Chile</option>
                <option value="Perú">🇵🇪 Perú</option>
              </select>
            </div>
          </div>
        </div>

        {/* Configuración Operativa */}
        <div className="settings-section">
          <h3>📋 Configuración Operativa</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Frecuencia de pedidos:</label>
              <select
                value={settings.orderFrequency}
                onChange={(e) => setSettings({...settings, orderFrequency: e.target.value})}
              >
                <option value="daily">📅 Diario</option>
                <option value="weekly">📅 Semanal</option>
                <option value="biweekly">📅 Quincenal</option>
                <option value="monthly">📅 Mensual</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Hora predeterminada de pedidos:</label>
              <input
                type="time"
                value={settings.defaultOrderTime}
                onChange={(e) => setSettings({...settings, defaultOrderTime: e.target.value})}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Moneda:</label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({...settings, currency: e.target.value})}
              >
                <option value="MXN">🇲🇽 Peso Mexicano (MXN)</option>
                <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                <option value="COP">🇨🇴 Peso Colombiano (COP)</option>
                <option value="ARS">🇦🇷 Peso Argentino (ARS)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Zona horaria:</label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({...settings, timezone: e.target.value})}
              >
                <option value="America/Mexico_City">🇲🇽 México (GMT-6)</option>
                <option value="America/New_York">🇺🇸 Este (GMT-5)</option>
                <option value="America/Chicago">🇺🇸 Centro (GMT-6)</option>
                <option value="America/Denver">🇺🇸 Montaña (GMT-7)</option>
                <option value="America/Los_Angeles">🇺🇸 Pacífico (GMT-8)</option>
                <option value="America/Bogota">🇨🇴 Colombia (GMT-5)</option>
                <option value="America/Argentina/Buenos_Aires">🇦🇷 Argentina (GMT-3)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="settings-section">
          <h3>🔔 Notificaciones</h3>
          
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.urgentNotifications}
                onChange={(e) => setSettings({...settings, urgentNotifications: e.target.checked})}
              />
              <span>🚨 Notificaciones de pedidos urgentes</span>
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
              />
              <span>📧 Notificaciones por email</span>
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoAssignProviders}
                onChange={(e) => setSettings({...settings, autoAssignProviders: e.target.checked})}
              />
              <span>🏪 Asignación automática de proveedores</span>
            </label>
          </div>
        </div>

        {/* Acciones */}
        <div className="form-actions">
          <button 
            type="button" 
            onClick={handleReset}
            className="reset-button"
            disabled={!hasChanges()}
          >
            🔄 Descartar Cambios
          </button>
          
          <button 
            type="submit" 
            disabled={saving || !hasChanges()}
            className="save-button"
          >
            {saving ? '💾 Guardando...' : '💾 Guardar Configuración'}
          </button>
        </div>
      </form>

      {/* Información adicional */}
      <div className="settings-info">
        <div className="info-card">
          <h4>ℹ️ Información</h4>
          <ul>
            <li>Los cambios en la configuración afectan a toda la organización</li>
            <li>Los códigos adicionales permiten registrar personal de nuevas sucursales</li>
            <li>Las notificaciones se envían según las preferencias configuradas</li>
            <li>La zona horaria afecta los reportes y estadísticas</li>
          </ul>
        </div>
        
        <div className="info-card">
          <h4>🔒 Seguridad</h4>
          <ul>
            <li>Solo administradores pueden modificar esta configuración</li>
            <li>Los códigos de organización no se pueden cambiar</li>
            <li>Todos los cambios quedan registrados</li>
            <li>Se recomienda revisar la configuración mensualmente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default OrganizationSettings;