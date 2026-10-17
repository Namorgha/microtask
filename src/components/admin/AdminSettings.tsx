import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

type SettingKey = "require_email_verification" | "enable_new_signups" | "platform_fee_percent" | "min_task_price" | "max_task_price" | "default_radius_km";

export default function AdminSettings({ adminId }: { adminId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-all-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      const map: Record<string, any> = {};
      data.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const [localValues, setLocalValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (settings) setLocalValues(settings);
  }, [settings]);

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase.from("app_settings").update({ value: JSON.stringify(value) as any, updated_at: new Date().toISOString() }).eq("key", key);
      if (error) throw error;
      await supabase.from("activity_logs").insert({ admin_id: adminId, action: `update_setting_${key}`, target_type: "setting", target_id: key });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-all-settings"] }); qc.invalidateQueries({ queryKey: ["app-settings"] }); toast({ title: "Setting saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const parseBool = (v: any) => v === true || v === "true";
  const parseNum = (v: any) => Number(v) || 0;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const toggleSetting = (key: SettingKey) => {
    const current = parseBool(localValues[key]);
    updateSetting.mutate({ key, value: !current });
  };

  const saveNumSetting = (key: SettingKey) => {
    updateSetting.mutate({ key, value: parseNum(localValues[key]) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Platform Toggles</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow label="Require Email Verification" desc="Users must verify email before posting tasks. Turn OFF if email verification is not working." checked={parseBool(localValues.require_email_verification)} onToggle={() => toggleSetting("require_email_verification")} disabled={updateSetting.isPending} />
          <ToggleRow label="Enable New Signups" desc="When OFF, no new users can register on the platform." checked={parseBool(localValues.enable_new_signups)} onToggle={() => toggleSetting("enable_new_signups")} disabled={updateSetting.isPending} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Platform Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <NumRow label="Platform Fee (%)" value={localValues.platform_fee_percent} onChange={(v) => setLocalValues(prev => ({ ...prev, platform_fee_percent: v }))} onSave={() => saveNumSetting("platform_fee_percent")} disabled={updateSetting.isPending} />
          <NumRow label="Min Task Price ($)" value={localValues.min_task_price} onChange={(v) => setLocalValues(prev => ({ ...prev, min_task_price: v }))} onSave={() => saveNumSetting("min_task_price")} disabled={updateSetting.isPending} />
          <NumRow label="Max Task Price ($)" value={localValues.max_task_price} onChange={(v) => setLocalValues(prev => ({ ...prev, max_task_price: v }))} onSave={() => saveNumSetting("max_task_price")} disabled={updateSetting.isPending} />
          <NumRow label="Default Radius (km)" value={localValues.default_radius_km} onChange={(v) => setLocalValues(prev => ({ ...prev, default_radius_km: v }))} onSave={() => saveNumSetting("default_radius_km")} disabled={updateSetting.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onToggle, disabled }: { label: string; desc: string; checked: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <Label className="text-base font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
    </div>
  );
}

function NumRow({ label, value, onChange, onSave, disabled }: { label: string; value: any; onChange: (v: string) => void; onSave: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4">
      <Label className="text-base font-medium flex-1">{label}</Label>
      <Input type="number" className="w-28" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      <Button size="sm" onClick={onSave} disabled={disabled}><Save className="h-4 w-4" /></Button>
    </div>
  );
}
