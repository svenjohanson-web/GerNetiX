import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'dashboard' | 'devices' | 'alerts' | 'profile';

const COLORS = {
  background: '#07110F',
  surface: '#0D1A17',
  surfaceRaised: '#12231F',
  border: '#1F3932',
  text: '#F0F7F4',
  muted: '#8EA59E',
  green: '#65E6A6',
  greenDark: '#163A2D',
  blue: '#70B9FF',
  amber: '#FFCC68',
  red: '#FF7B7B',
};

const tabs: Array<{ id: Tab; label: string; icon: IconName; active: IconName }> = [
  { id: 'dashboard', label: 'Übersicht', icon: 'grid-outline', active: 'grid' },
  { id: 'devices', label: 'Geräte', icon: 'hardware-chip-outline', active: 'hardware-chip' },
  { id: 'alerts', label: 'Alarme', icon: 'notifications-outline', active: 'notifications' },
  { id: 'profile', label: 'Profil', icon: 'person-outline', active: 'person' },
];

const chartPoints = [34, 38, 36, 42, 48, 44, 52, 57, 54, 62, 59, 66, 63, 70, 68, 74];

function MetricCard({
  icon,
  label,
  value,
  unit,
  color,
  note,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit: string;
  color: string;
  note: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { backgroundColor: `${color}1C` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.muted} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
      <Text style={[styles.metricNote, { color }]}>{note}</Text>
    </View>
  );
}

function MiniChart() {
  return (
    <View style={styles.chart}>
      {chartPoints.map((point, index) => (
        <View
          key={`${point}-${index}`}
          style={[
            styles.chartBar,
            {
              height: `${point}%`,
              opacity: 0.42 + index / chartPoints.length / 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

function Dashboard({ onEdit }: { onEdit: () => void }) {
  const [temperature, setTemperature] = useState(23.8);

  useEffect(() => {
    const timer = setInterval(() => {
      setTemperature((current) => Number((current + (Math.random() - 0.48) * 0.12).toFixed(1)));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.projectRow}>
        <View>
          <Text style={styles.eyebrow}>MEIN ZUHAUSE</Text>
          <Text style={styles.title}>Guten Morgen, Sven.</Text>
        </View>
        <Pressable style={styles.roundButton} onPress={onEdit}>
          <Ionicons name="options-outline" size={21} color={COLORS.text} />
        </Pressable>
      </View>

      <Pressable style={styles.locationCard}>
        <View style={styles.locationIcon}>
          <Ionicons name="leaf" size={23} color={COLORS.green} />
        </View>
        <View style={styles.locationText}>
          <Text style={styles.locationTitle}>Gewächshaus</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>3 Geräte online · gerade aktualisiert</Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={20} color={COLORS.muted} />
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Live-Werte</Text>
        <Text style={styles.liveText}>● LIVE</Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard icon="thermometer" label="Temperatur" value={temperature.toFixed(1)} unit="°C" color={COLORS.amber} note="Im Wohlfühlbereich" />
        <MetricCard icon="water" label="Luftfeuchte" value="68" unit="%" color={COLORS.blue} note="+3 % seit 08:00" />
        <MetricCard icon="leaf" label="Bodenfeuchte" value="42" unit="%" color={COLORS.green} note="Nächste Prüfung 18:00" />
        <MetricCard icon="sunny" label="Licht" value="8.4" unit="klx" color="#F6E57A" note="Optimal für Pflanzen" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Heute</Text>
        <Pressable><Text style={styles.link}>Details</Text></Pressable>
      </View>

      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View>
            <Text style={styles.historyLabel}>Temperaturverlauf</Text>
            <Text style={styles.historyRange}>18,9° – 24,6°</Text>
          </View>
          <View style={styles.periodPill}><Text style={styles.periodText}>24 Std.</Text></View>
        </View>
        <MiniChart />
        <View style={styles.axisRow}>
          <Text style={styles.axisText}>00:00</Text><Text style={styles.axisText}>06:00</Text>
          <Text style={styles.axisText}>12:00</Text><Text style={styles.axisText}>Jetzt</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Letzte Aktivität</Text>
      </View>
      <View style={styles.activityCard}>
        <View style={[styles.activityIcon, { backgroundColor: COLORS.greenDark }]}>
          <Ionicons name="water" size={19} color={COLORS.green} />
        </View>
        <View style={styles.activityText}>
          <Text style={styles.activityTitle}>Bewässerung beendet</Text>
          <Text style={styles.activityMeta}>Pumpe 1 · 2 Min. Laufzeit</Text>
        </View>
        <Text style={styles.activityTime}>10:42</Text>
      </View>
    </ScrollView>
  );
}

const deviceRows = [
  { name: 'Klima-Sensor', room: 'Gewächshaus', icon: 'thermometer-outline' as IconName, battery: '84 %' },
  { name: 'Boden-Sensor', room: 'Beet Nord', icon: 'leaf-outline' as IconName, battery: '71 %' },
  { name: 'Pumpensteuerung', room: 'Technikbox', icon: 'water-outline' as IconName, battery: 'Netz' },
];

function Devices() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.eyebrow}>GERNETIX</Text>
      <Text style={styles.title}>Meine Geräte</Text>
      <Text style={styles.subtitle}>Alle Sensoren und Aktoren an einem Ort.</Text>
      {deviceRows.map((device, index) => (
        <Pressable key={device.name} style={styles.listCard}>
          <View style={styles.deviceIcon}><Ionicons name={device.icon} size={23} color={COLORS.green} /></View>
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>{device.name}</Text>
            <Text style={styles.activityMeta}>{device.room} · online</Text>
          </View>
          <Text style={styles.deviceBattery}>{device.battery}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable>
      ))}
      <Pressable style={styles.primaryButton}>
        <Ionicons name="add" size={21} color={COLORS.background} />
        <Text style={styles.primaryButtonText}>Gerät hinzufügen</Text>
      </Pressable>
    </ScrollView>
  );
}

function Alerts() {
  const [temperature, setTemperature] = useState(true);
  const [offline, setOffline] = useState(true);
  const [soil, setSoil] = useState(false);
  const alertRows = useMemo(() => [
    { title: 'Temperatur über 28 °C', detail: 'Gewächshaus', icon: 'thermometer-outline' as IconName, value: temperature, setter: setTemperature },
    { title: 'Gerät nicht erreichbar', detail: 'Alle Geräte · nach 10 Minuten', icon: 'cloud-offline-outline' as IconName, value: offline, setter: setOffline },
    { title: 'Bodenfeuchte unter 25 %', detail: 'Beet Nord', icon: 'leaf-outline' as IconName, value: soil, setter: setSoil },
  ], [temperature, offline, soil]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.eyebrow}>BENACHRICHTIGUNGEN</Text>
      <Text style={styles.title}>Meine Alarme</Text>
      <Text style={styles.subtitle}>Du entscheidest, wann GerNetiX sich meldet.</Text>
      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark" size={21} color={COLORS.green} />
        <Text style={styles.infoText}>Push-Mitteilungen sind für dieses Gerät aktiviert.</Text>
      </View>
      {alertRows.map((alert) => (
        <View key={alert.title} style={styles.listCard}>
          <View style={styles.deviceIcon}><Ionicons name={alert.icon} size={22} color={COLORS.green} /></View>
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>{alert.title}</Text>
            <Text style={styles.activityMeta}>{alert.detail}</Text>
          </View>
          <Switch value={alert.value} onValueChange={alert.setter} trackColor={{ false: COLORS.border, true: COLORS.green }} thumbColor={COLORS.text} />
        </View>
      ))}
      <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Neue Alarmregel</Text></Pressable>
    </ScrollView>
  );
}

function Profile() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.eyebrow}>KONTO</Text>
      <Text style={styles.title}>Profil</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>S</Text></View>
        <View><Text style={styles.activityTitle}>Sven</Text><Text style={styles.activityMeta}>GerNetiX Demo-Konto</Text></View>
      </View>
      {[
        ['home-outline', 'Zuhause und Projekte'],
        ['notifications-outline', 'Mitteilungen'],
        ['shield-checkmark-outline', 'Sicherheit und Datenschutz'],
        ['help-circle-outline', 'Hilfe und Feedback'],
      ].map(([icon, label]) => (
        <Pressable key={label} style={styles.profileRow}>
          <Ionicons name={icon as IconName} size={21} color={COLORS.muted} />
          <Text style={styles.profileRowText}>{label}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable>
      ))}
      <Text style={styles.demoNotice}>Demo-Modus · keine echten Kontodaten</Text>
    </ScrollView>
  );
}

function EditDashboard({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [enabled, setEnabled] = useState([true, true, true, true]);
  const cards = ['Temperatur', 'Luftfeuchte', 'Bodenfeuchte', 'Licht'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalTitleRow}>
            <View><Text style={styles.modalTitle}>Dashboard anpassen</Text><Text style={styles.modalSubtitle}>Karten ein- oder ausblenden</Text></View>
            <Pressable style={styles.closeButton} onPress={onClose}><Ionicons name="close" size={21} color={COLORS.text} /></Pressable>
          </View>
          {cards.map((card, index) => (
            <Pressable key={card} style={styles.editRow} onPress={() => setEnabled((values) => values.map((value, valueIndex) => valueIndex === index ? !value : value))}>
              <Ionicons name="reorder-three" size={24} color={COLORS.muted} />
              <Text style={styles.editLabel}>{card}</Text>
              <Ionicons name={enabled[index] ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={enabled[index] ? COLORS.green : COLORS.muted} />
            </Pressable>
          ))}
          <Pressable style={styles.primaryButton} onPress={onClose}><Text style={styles.primaryButtonText}>Fertig</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AppContent() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [editing, setEditing] = useState(false);
  const content = tab === 'dashboard' ? <Dashboard onEdit={() => setEditing(true)} />
    : tab === 'devices' ? <Devices /> : tab === 'alerts' ? <Alerts /> : <Profile />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.app}>{content}</View>
      <View style={styles.tabBar}>
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable key={item.id} style={styles.tab} onPress={() => setTab(item.id)}>
              <Ionicons name={active ? item.active : item.icon} size={23} color={active ? COLORS.green : COLORS.muted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              {item.id === 'alerts' && <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>}
            </Pressable>
          );
        })}
      </View>
      <EditDashboard visible={editing} onClose={() => setEditing(false)} />
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  app: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34 },
  eyebrow: { color: COLORS.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 5 },
  title: { color: COLORS.text, fontSize: 27, lineHeight: 33, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginTop: 7, marginBottom: 22 },
  projectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  locationCard: { marginTop: 24, padding: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, flexDirection: 'row', alignItems: 'center' },
  locationIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.greenDark, alignItems: 'center', justifyContent: 'center' },
  locationText: { flex: 1, marginLeft: 12 },
  locationTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  onlineRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green, marginRight: 6 },
  onlineText: { color: COLORS.muted, fontSize: 11 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 27, marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  liveText: { color: COLORS.green, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  link: { color: COLORS.green, fontSize: 13, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48.5%', minHeight: 162, padding: 15, borderRadius: 19, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: COLORS.muted, fontSize: 12, marginTop: 14 },
  metricValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  metricValue: { color: COLORS.text, fontSize: 29, lineHeight: 35, fontWeight: '700', letterSpacing: -0.7 },
  metricUnit: { color: COLORS.muted, fontSize: 14, marginLeft: 3, marginBottom: 4 },
  metricNote: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  historyCard: { padding: 17, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  historyLabel: { color: COLORS.muted, fontSize: 12 },
  historyRange: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 3 },
  periodPill: { backgroundColor: COLORS.surfaceRaised, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  periodText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  chart: { height: 90, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  chartBar: { flex: 1, minHeight: 8, backgroundColor: COLORS.green, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { color: COLORS.muted, fontSize: 9 },
  activityCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  activityIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityText: { flex: 1, marginLeft: 12 },
  activityTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  activityMeta: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  activityTime: { color: COLORS.muted, fontSize: 11 },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  deviceIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: COLORS.greenDark, alignItems: 'center', justifyContent: 'center' },
  deviceBattery: { color: COLORS.muted, fontSize: 11, marginRight: 6 },
  primaryButton: { minHeight: 50, borderRadius: 15, backgroundColor: COLORS.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  primaryButtonText: { color: COLORS.background, fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  secondaryButtonText: { color: COLORS.green, fontSize: 14, fontWeight: '800' },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 15, backgroundColor: COLORS.greenDark, marginBottom: 18 },
  infoText: { flex: 1, color: '#BDEDD4', fontSize: 12, lineHeight: 17 },
  profileCard: { marginTop: 22, marginBottom: 20, flexDirection: 'row', alignItems: 'center', padding: 17, borderRadius: 19, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 13, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.background, fontWeight: '800', fontSize: 19 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 55, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  profileRowText: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
  demoNotice: { textAlign: 'center', color: COLORS.muted, fontSize: 11, marginTop: 28 },
  tabBar: { minHeight: 73, paddingTop: 9, paddingBottom: 8, paddingHorizontal: 7, backgroundColor: '#0A1613', borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '600', marginTop: 4 },
  tabLabelActive: { color: COLORS.green },
  badge: { position: 'absolute', top: 0, right: 21, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A1613' },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 32, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border },
  modalHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.muted, opacity: 0.45, marginBottom: 20 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '700' },
  modalSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  editRow: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  editLabel: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
