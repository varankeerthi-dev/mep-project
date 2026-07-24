export const fmt = (n: any) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export const fmtD = (d?: string | null) => {
  if (!d) return '-';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '-' : x.toLocaleDateString();
};
