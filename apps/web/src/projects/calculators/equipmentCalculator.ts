export type EquipmentStats = {
  active: number;
  expired: number;
  expiring30: number;
  expiring90: number;
};

export function calculateEquipmentStats(projectEquipment: any[]): EquipmentStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  let active = 0;
  let expired = 0;
  let expiring30 = 0;
  let expiring90 = 0;

  projectEquipment.forEach((eq: any) => {
    if (!eq.warranty_end_date) return;
    const endDate = new Date(eq.warranty_end_date);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) {
      expired++;
    } else {
      active++;
      if (endDate <= thirtyDaysFromNow) {
        expiring30++;
      } else if (endDate <= ninetyDaysFromNow) {
        expiring90++;
      }
    }
  });

  return { active, expired, expiring30, expiring90 };
}
