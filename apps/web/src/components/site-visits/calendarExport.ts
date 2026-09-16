export const formatUTC = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export const escapeIcsText = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
};

export const handleAddToGoogleCalendar = (visit: any) => {
  if (!visit || !visit.visit_date) return;

  const dateStr = visit.visit_date; // YYYY-MM-DD
  const timeStr = visit.visit_time; // HH:mm or HH:mm:ss

  let dates = '';
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
    const start = new Date(year, month - 1, day);
    start.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    dates = `${formatUTC(start)}/${formatUTC(end)}`;
  } else {
    const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
    const startDateObj = new Date(year, month - 1, day);
    const endDateObj = new Date(startDateObj.getTime() + 24 * 60 * 60 * 1000);
    
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const r = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${r}`;
    };
    
    dates = `${formatYMD(startDateObj)}/${formatYMD(endDateObj)}`;
  }

  const clientName = visit.clients?.client_name || 'N/A';
  const purpose = visit.purpose_of_visit || 'Site Visit';
  const title = `Site Visit: ${purpose} - ${clientName}`;

  const engineerName = visit.engineer || visit.visited_by || 'N/A';
  const contactPerson = visit.site_contact_person
    ? `${visit.site_contact_person} (${visit.site_contact_designation || 'Contact'}) - ${visit.site_contact_phone || ''}`
    : 'N/A';
  const notes = visit.discussion_points || '';

  const details = [
    `Client: ${clientName}`,
    `Purpose: ${purpose}`,
    `Engineer/Visited By: ${engineerName}`,
    `Site Contact: ${contactPerson}`,
    notes ? `Discussion/Notes:\n${notes}` : ''
  ].filter(Boolean).join('\n\n');

  const location = visit.site_address || '';

  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  window.open(gcalUrl, '_blank');
};

export const handleDownloadIcsFile = (visit: any) => {
  if (!visit || !visit.visit_date) return;

  const dateStr = visit.visit_date; // YYYY-MM-DD
  const timeStr = visit.visit_time; // HH:mm or HH:mm:ss

  let dtstart = '';
  let dtend = '';

  const clientName = visit.clients?.client_name || 'N/A';
  const purpose = visit.purpose_of_visit || 'Site Visit';
  const title = `Site Visit: ${purpose} - ${clientName}`;

  const engineerName = visit.engineer || visit.visited_by || 'N/A';
  const contactPerson = visit.site_contact_person
    ? `${visit.site_contact_person} (${visit.site_contact_designation || 'Contact'}) - ${visit.site_contact_phone || ''}`
    : 'N/A';
  const notes = visit.discussion_points || '';

  const details = [
    `Client: ${clientName}`,
    `Purpose: ${purpose}`,
    `Engineer/Visited By: ${engineerName}`,
    `Site Contact: ${contactPerson}`,
    notes ? `Discussion/Notes:\n${notes}` : ''
  ].filter(Boolean).join('\n\n');

  const location = visit.site_address || '';

  if (timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
    const start = new Date(year, month - 1, day);
    start.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    dtstart = `DTSTART:${formatUTC(start)}`;
    dtend = `DTEND:${formatUTC(end)}`;
  } else {
    const [year, month, day] = dateStr.split('-').map((num: string) => parseInt(num, 10));
    const startDateObj = new Date(year, month - 1, day);
    const endDateObj = new Date(startDateObj.getTime() + 24 * 60 * 60 * 1000);
    
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const r = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${r}`;
    };
    
    dtstart = `DTSTART;VALUE=DATE:${formatYMD(startDateObj)}`;
    dtend = `DTEND;VALUE=DATE:${formatYMD(endDateObj)}`;
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MEP Project//Site Visit Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:site-visit-${visit.id || Date.now()}@mep-project`,
    `DTSTAMP:${formatUTC(new Date())}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(details)}`,
    `LOCATION:${escapeIcsText(location)}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `site-visit-${visit.visit_date || 'event'}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
