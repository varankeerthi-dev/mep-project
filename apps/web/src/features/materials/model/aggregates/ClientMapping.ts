/** Client mapping row in the editor */
export interface ClientMappingRow {
  id: string;
  client_id: string;
  company_variant_id: string | null;
  client_part_no: string;
  client_description: string;
}
