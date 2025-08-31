
export const getOrganizationId = (user) => {
  // Agregar búsqueda dentro de user.organizationId si existe
  if (user?.organizationId) return user.organizationId;

  // Fallback si viene dentro del objeto restaurant
  if (user?.restaurant && typeof user.restaurant === 'object' && user.restaurant.id) {
    return user.restaurant.id;
  }

  // Fallback si restaurant es un string
  if (typeof user?.restaurant === 'string') return user.restaurant;

  return null;
};

export const canAdmin = (user) => {
  const role = (user?.role ?? '').toString().toLowerCase().trim();
  return (
    role === 'admin' ||
    role === 'administrador' ||
    user?.roles?.admin === true ||
    user?.isAdmin === true ||
    user?.permissions?.includes('admin') ||
    user?.permissions?.includes('inventory.manage')
  );
};
