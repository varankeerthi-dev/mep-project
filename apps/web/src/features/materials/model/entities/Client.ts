/** Domain entity for a client. Mirrors the `clients` DB table. */
export interface Client {
  id: string;
  client_name: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}
