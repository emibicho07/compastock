export const getOrganizationId = (user) => {
  return user?.organizationId || user?.restaurant?.id || user?.restaurant || null;
};
