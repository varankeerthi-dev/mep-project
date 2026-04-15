import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SubconMeasurementForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    measurementDate: new Date().toISOString().split('T')[0],
    measurementBy: '',
    subContractorName: '',
    project: '',
    site: '',
    sNo: '',
    description: '',
    qty: '',
    unit: '',
    remarks: ''
  });

  const handleSave = async () => {
    setLoading(true);
    const GAS_URL = "https://script.google.com/macros/u/1/s/AKfycbz0S4we7DvPHig9FqE8Sfnwm9Hi1zP5VPIcmxVlxuMPTp9_rcMiJoRP1wJrnwK7CCW57g/exec";

    try {
      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors', // Critical for Google Scripts
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      alert("Measurement saved to Google Sheet!");
    } catch (error) {
      console.error(error);
      alert("Error saving data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Sub-Contractor Measurement Sheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" value={formData.measurementDate} onChange={(e) => setFormData({...formData, measurementDate: e.target.value})} />
            <Input placeholder="Measurement By" onChange={(e) => setFormData({...formData, measurementBy: e.target.value})} />
          </div>
          
          <Input placeholder="Sub-Contractor Name" onChange={(e) => setFormData({...formData, subContractorName: e.target.value})} />
          
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="Project" onChange={(e) => setFormData({...formData, project: e.target.value})} />
            <Input placeholder="Site" onChange={(e) => setFormData({...formData, site: e.target.value})} />
          </div>

          <hr />

          <div className="grid grid-cols-4 gap-2">
            <Input placeholder="S.No" className="col-span-1" onChange={(e) => setFormData({...formData, sNo: e.target.value})} />
            <Input placeholder="Description" className="col-span-3" onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input type="number" placeholder="Qty" onChange={(e) => setFormData({...formData, qty: e.target.value})} />
            <Input placeholder="Unit (e.g. SqFt, Rmt)" onChange={(e) => setFormData({...formData, unit: e.target.value})} />
          </div>

          <Input placeholder="Remarks" onChange={(e) => setFormData({...formData, remarks: e.target.value})} />

          <Button className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Measurement"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
