export interface DTCEntry {
  code: string;
  title: string;
  description: string;
  symptoms: string[];
  fixes: string[];
}

export const dtcDatabase: Record<string, DTCEntry> = {
  P0101: {
    code: "P0101",
    title: "Mass Air Flow Sensor Range/Performance",
    description: "The MAF sensor signal is outside the expected range for current engine operating conditions. The ECU cannot accurately calculate fuel delivery.",
    symptoms: [
      "Rough idle or stalling",
      "Hesitation on acceleration",
      "Poor fuel economy",
      "Black smoke from exhaust",
    ],
    fixes: [
      "Clean the MAF sensor with MAF-specific cleaner spray",
      "Check for air leaks between the MAF sensor and throttle body",
      "Inspect and replace the air filter if dirty or damaged",
      "Check MAF sensor wiring and connector for damage or corrosion",
      "Replace the MAF sensor",
    ],
  },
  P0107: {
    code: "P0107",
    title: "MAP Sensor Low Input",
    description: "The Manifold Absolute Pressure sensor voltage is below the expected minimum. This can cause incorrect fuel and ignition calculations.",
    symptoms: [
      "Engine runs rich or lean",
      "Rough idle",
      "Lack of power",
      "Check engine light on",
    ],
    fixes: [
      "Inspect the MAP sensor vacuum hose for cracks or disconnection",
      "Check the MAP sensor electrical connector for corrosion",
      "Test MAP sensor voltage with a multimeter (should read ~1V at idle, ~4.5V at WOT)",
      "Replace the MAP sensor",
    ],
  },
  P0108: {
    code: "P0108",
    title: "MAP Sensor High Input",
    description: "The Manifold Absolute Pressure sensor voltage is above the expected maximum. The ECU sees incorrect intake manifold pressure readings.",
    symptoms: [
      "Engine runs rich",
      "Poor fuel economy",
      "Black smoke from exhaust",
      "Rough idle",
    ],
    fixes: [
      "Check for a disconnected or cracked vacuum hose to the MAP sensor",
      "Inspect MAP sensor connector for bent or shorted pins",
      "Test MAP sensor output with a multimeter",
      "Replace the MAP sensor",
    ],
  },
  P0112: {
    code: "P0112",
    title: "Intake Air Temperature Sensor Low",
    description: "The IAT sensor reading is below the expected minimum temperature, indicating a possible short circuit in the sensor or wiring.",
    symptoms: [
      "Engine may run rich (too much fuel)",
      "Slightly rough idle when cold",
      "Check engine light on",
    ],
    fixes: [
      "Inspect the IAT sensor connector for corrosion or damage",
      "Check wiring for shorts to ground",
      "Test sensor resistance with a multimeter (should change with temperature)",
      "Replace the IAT sensor",
    ],
  },
  P0113: {
    code: "P0113",
    title: "Intake Air Temperature Sensor High",
    description: "The IAT sensor reading is above the expected maximum, indicating an open circuit or disconnected sensor.",
    symptoms: [
      "Engine may run lean (not enough fuel)",
      "Possible detonation/knocking",
      "Check engine light on",
    ],
    fixes: [
      "Check the IAT sensor connector — it may be unplugged",
      "Inspect wiring for open circuits or breaks",
      "Test sensor resistance (should be ~2-3k ohms at room temperature)",
      "Replace the IAT sensor",
    ],
  },
  P0116: {
    code: "P0116",
    title: "Coolant Temperature Sensor Range/Performance",
    description: "The engine coolant temperature sensor reading does not match expected warm-up patterns. The ECU cannot properly manage cold-start fuel enrichment.",
    symptoms: [
      "Fans may run constantly or not at all",
      "Poor cold-start performance",
      "Gauge reads incorrectly",
      "Poor fuel economy",
    ],
    fixes: [
      "Check coolant level — low coolant can give false readings",
      "Inspect the ECT sensor connector for corrosion",
      "Verify the thermostat is opening properly",
      "Test ECT sensor resistance (should decrease as engine warms up)",
      "Replace the ECT sensor",
    ],
  },
  P0117: {
    code: "P0117",
    title: "Coolant Temperature Sensor Low Input",
    description: "The coolant temperature sensor voltage is below the expected minimum, indicating a short to ground.",
    symptoms: [
      "Cooling fans run constantly",
      "Engine may run rich",
      "Gauge reads maximum temperature",
    ],
    fixes: [
      "Check ECT sensor wiring for shorts to ground",
      "Inspect connector for water intrusion or corrosion",
      "Test sensor resistance with a multimeter",
      "Replace the ECT sensor",
    ],
  },
  P0118: {
    code: "P0118",
    title: "Coolant Temperature Sensor High Input",
    description: "The coolant temperature sensor voltage is above the expected maximum, indicating an open circuit.",
    symptoms: [
      "Fans may not turn on",
      "Engine may run lean during warm-up",
      "Gauge reads cold even when engine is warm",
    ],
    fixes: [
      "Check the ECT sensor connector — may be unplugged",
      "Inspect wiring for open circuits",
      "Test sensor resistance",
      "Replace the ECT sensor",
    ],
  },
  P0122: {
    code: "P0122",
    title: "Throttle Position Sensor Low Input",
    description: "The TPS voltage is below the expected minimum. The ECU cannot accurately determine throttle opening.",
    symptoms: [
      "Engine surges or hesitates",
      "Poor acceleration response",
      "Idle speed may fluctuate",
      "Possible limp mode",
    ],
    fixes: [
      "Check TPS connector for corrosion or loose pins",
      "Inspect wiring for shorts to ground",
      "Verify 5V reference voltage at the sensor",
      "Replace the TPS sensor",
    ],
  },
  P0123: {
    code: "P0123",
    title: "Throttle Position Sensor High Input",
    description: "The TPS voltage is above the expected maximum, indicating a short to the 5V reference or internal sensor failure.",
    symptoms: [
      "High idle speed",
      "Engine revs on its own",
      "Possible limp mode",
    ],
    fixes: [
      "Check TPS connector and wiring for shorts",
      "Verify ground circuit integrity",
      "Test TPS voltage sweep with a multimeter (should go from ~0.5V to ~4.5V smoothly)",
      "Replace the TPS sensor",
    ],
  },
  P0128: {
    code: "P0128",
    title: "Thermostat Below Regulating Temperature",
    description: "The engine is not reaching normal operating temperature within the expected time. Usually means the thermostat is stuck open.",
    symptoms: [
      "Temperature gauge stays low",
      "Poor heater output",
      "Slightly worse fuel economy",
      "Engine takes very long to warm up",
    ],
    fixes: [
      "Check coolant level",
      "Replace the thermostat (most common fix)",
      "Verify the ECT sensor is reading correctly",
      "Check for cooling fan running too early",
    ],
  },
  P0131: {
    code: "P0131",
    title: "O2 Sensor Low Voltage (Bank 1 Sensor 1)",
    description: "The upstream oxygen sensor voltage is stuck low, indicating a lean condition or sensor failure.",
    symptoms: [
      "Poor fuel economy",
      "Rough idle",
      "Hesitation on acceleration",
    ],
    fixes: [
      "Check for exhaust leaks before the O2 sensor",
      "Inspect O2 sensor wiring and connector",
      "Check for vacuum leaks causing a lean condition",
      "Replace the upstream O2 sensor",
    ],
  },
  P0132: {
    code: "P0132",
    title: "O2 Sensor High Voltage (Bank 1 Sensor 1)",
    description: "The upstream oxygen sensor voltage is stuck high, indicating a rich condition or sensor failure.",
    symptoms: [
      "Rich exhaust smell",
      "Black smoke from exhaust",
      "Poor fuel economy",
    ],
    fixes: [
      "Check for leaking fuel injectors",
      "Inspect O2 sensor wiring for shorts",
      "Check fuel pressure (may be too high)",
      "Replace the upstream O2 sensor",
    ],
  },
  P0133: {
    code: "P0133",
    title: "O2 Sensor Slow Response (Bank 1 Sensor 1)",
    description: "The front oxygen sensor is switching between rich and lean too slowly. This degrades the ECU's ability to fine-tune the air/fuel ratio.",
    symptoms: [
      "Slightly poor fuel economy",
      "May not pass emissions testing",
      "Subtle performance loss",
    ],
    fixes: [
      "Check for exhaust leaks near the sensor",
      "Clean or replace the O2 sensor (sensors degrade over time)",
      "Check for contamination from oil burning or coolant leak",
      "Replace the upstream O2 sensor",
    ],
  },
  P0135: {
    code: "P0135",
    title: "O2 Sensor Heater Circuit (Bank 1 Sensor 1)",
    description: "The heater circuit in the upstream O2 sensor has failed. The sensor takes longer to reach operating temperature.",
    symptoms: [
      "Extended warm-up enrichment (poor cold fuel economy)",
      "Check engine light on",
    ],
    fixes: [
      "Check the O2 sensor heater fuse",
      "Inspect wiring and connector for damage",
      "Measure heater resistance (should be 10-20 ohms typically)",
      "Replace the O2 sensor",
    ],
  },
  P0141: {
    code: "P0141",
    title: "O2 Sensor Heater Circuit (Bank 1 Sensor 2)",
    description: "The heater circuit in the downstream (post-cat) O2 sensor has failed.",
    symptoms: [
      "Check engine light on",
      "May not pass emissions",
    ],
    fixes: [
      "Check the O2 sensor heater fuse",
      "Inspect wiring and connector",
      "Replace the downstream O2 sensor",
    ],
  },
  P0171: {
    code: "P0171",
    title: "System Too Lean (Bank 1)",
    description: "The ECU detects the engine is running lean overall. There is too much air or not enough fuel in the mixture.",
    symptoms: [
      "Rough idle",
      "Hesitation or misfires",
      "Poor performance",
      "Possible hissing sound from vacuum leak",
    ],
    fixes: [
      "Check for vacuum leaks (intake manifold gasket, hoses, PCV valve)",
      "Clean or replace the MAF sensor",
      "Check fuel pressure with a gauge",
      "Inspect fuel injectors for clogs — try fuel injector cleaner first",
      "Check for exhaust leaks before the O2 sensor",
    ],
  },
  P0172: {
    code: "P0172",
    title: "System Too Rich (Bank 1)",
    description: "The ECU detects the engine is running rich overall. There is too much fuel or not enough air.",
    symptoms: [
      "Black smoke from exhaust",
      "Fuel smell from exhaust",
      "Spark plugs fouled (black soot)",
      "Poor fuel economy",
    ],
    fixes: [
      "Check and replace the air filter if dirty",
      "Clean the MAF sensor",
      "Check fuel pressure (a stuck fuel pressure regulator can cause high pressure)",
      "Inspect for leaking fuel injectors",
      "Check the EVAP purge valve for sticking open",
    ],
  },
  P0300: {
    code: "P0300",
    title: "Random/Multiple Cylinder Misfire",
    description: "The ECU has detected misfires occurring in multiple cylinders with no consistent pattern. This is often caused by something affecting all cylinders like fuel delivery, ignition, or vacuum.",
    symptoms: [
      "Engine shakes or vibrates",
      "Flashing check engine light",
      "Loss of power",
      "Rough idle",
      "Poor fuel economy",
    ],
    fixes: [
      "Check and replace spark plugs if worn (NGK Iridium recommended for S2000/K-series)",
      "Inspect ignition coil packs for cracks or carbon tracking",
      "Check for vacuum leaks at the intake manifold",
      "Verify fuel pressure and injector operation",
      "Check valve adjustment (important on Honda K-series engines)",
    ],
  },
  P0301: {
    code: "P0301",
    title: "Cylinder 1 Misfire Detected",
    description: "The ECU detected repeated misfires in cylinder 1. This means the air/fuel mixture in cylinder 1 is not igniting properly.",
    symptoms: [
      "Rough idle",
      "Engine vibration",
      "Loss of power",
      "Flashing check engine light under load",
    ],
    fixes: [
      "Replace the spark plug in cylinder 1",
      "Swap the ignition coil with another cylinder to test if the misfire follows",
      "Check the fuel injector for cylinder 1 (swap-test or use a stethoscope)",
      "Perform a compression test on cylinder 1",
      "Check valve clearance on cylinder 1",
    ],
  },
  P0302: {
    code: "P0302",
    title: "Cylinder 2 Misfire Detected",
    description: "The ECU detected repeated misfires in cylinder 2.",
    symptoms: [
      "Rough idle",
      "Engine vibration",
      "Loss of power",
      "Flashing check engine light under load",
    ],
    fixes: [
      "Replace the spark plug in cylinder 2",
      "Swap the ignition coil with another cylinder to test",
      "Check the fuel injector for cylinder 2",
      "Perform a compression test on cylinder 2",
      "Check valve clearance on cylinder 2",
    ],
  },
  P0303: {
    code: "P0303",
    title: "Cylinder 3 Misfire Detected",
    description: "The ECU detected repeated misfires in cylinder 3.",
    symptoms: [
      "Rough idle",
      "Engine vibration",
      "Loss of power",
      "Flashing check engine light under load",
    ],
    fixes: [
      "Replace the spark plug in cylinder 3",
      "Swap the ignition coil with another cylinder to test",
      "Check the fuel injector for cylinder 3",
      "Perform a compression test on cylinder 3",
      "Check valve clearance on cylinder 3",
    ],
  },
  P0304: {
    code: "P0304",
    title: "Cylinder 4 Misfire Detected",
    description: "The ECU detected repeated misfires in cylinder 4.",
    symptoms: [
      "Rough idle",
      "Engine vibration",
      "Loss of power",
      "Flashing check engine light under load",
    ],
    fixes: [
      "Replace the spark plug in cylinder 4",
      "Swap the ignition coil with another cylinder to test",
      "Check the fuel injector for cylinder 4",
      "Perform a compression test on cylinder 4",
      "Check valve clearance on cylinder 4",
    ],
  },
  P0325: {
    code: "P0325",
    title: "Knock Sensor Circuit Malfunction",
    description: "The knock sensor signal is outside the expected range. The ECU uses this sensor to detect engine knock (detonation) and retard timing to prevent damage.",
    symptoms: [
      "Reduced engine performance (ECU retards timing as a safety measure)",
      "Possible pinging/knocking sound under load",
      "Check engine light on",
    ],
    fixes: [
      "Check knock sensor connector for corrosion or loose fit",
      "Inspect wiring between the sensor and ECU",
      "Verify knock sensor torque (must be torqued to spec, usually 20-25 ft-lbs)",
      "Replace the knock sensor",
    ],
  },
  P0335: {
    code: "P0335",
    title: "Crankshaft Position Sensor Circuit",
    description: "No signal from the crankshaft position sensor. The ECU needs this signal to determine engine speed and ignition timing.",
    symptoms: [
      "Engine cranks but won't start",
      "Engine stalls intermittently",
      "Tachometer may not work",
    ],
    fixes: [
      "Check the CKP sensor connector and wiring",
      "Inspect the sensor tip for metal debris or damage",
      "Check the air gap between sensor and reluctor ring",
      "Replace the crankshaft position sensor",
    ],
  },
  P0336: {
    code: "P0336",
    title: "Crankshaft Position Sensor Range/Performance",
    description: "The crankshaft position sensor signal is erratic or outside expected parameters.",
    symptoms: [
      "Engine stumbles or hesitates",
      "Intermittent stalling",
      "Hard starting",
    ],
    fixes: [
      "Check for metal debris on the sensor tip",
      "Inspect the reluctor ring (timing wheel) for damaged teeth",
      "Check sensor wiring for intermittent breaks",
      "Replace the CKP sensor",
    ],
  },
  P0339: {
    code: "P0339",
    title: "Crankshaft Position Sensor Intermittent",
    description: "The crankshaft position sensor signal drops out intermittently. This can cause random stalling.",
    symptoms: [
      "Random stalling especially when hot",
      "Intermittent no-start",
      "Engine cuts out briefly during driving",
    ],
    fixes: [
      "Inspect CKP sensor wiring for chafing or loose connections",
      "Check connector pins for spread or corrosion",
      "Replace the CKP sensor",
    ],
  },
  P0340: {
    code: "P0340",
    title: "Camshaft Position Sensor Circuit",
    description: "No signal from the camshaft position sensor. The ECU uses this to determine cam timing for fuel injection and VTC control.",
    symptoms: [
      "Engine may not start",
      "Rough running",
      "VTEC may not engage",
    ],
    fixes: [
      "Check CMP sensor connector and wiring",
      "Inspect sensor for damage or contamination",
      "Verify timing chain/belt condition and tension",
      "Replace the camshaft position sensor",
    ],
  },
  P0341: {
    code: "P0341",
    title: "Camshaft Position Sensor Range/Performance",
    description: "The camshaft position signal is outside the expected range relative to the crankshaft signal. This can indicate timing issues.",
    symptoms: [
      "Rough idle",
      "Loss of power",
      "VTEC may not function",
      "Poor fuel economy",
    ],
    fixes: [
      "Check timing chain tension and condition",
      "Inspect VTC actuator operation",
      "Check CMP sensor wiring",
      "Replace the CMP sensor",
    ],
  },
  P0401: {
    code: "P0401",
    title: "EGR Insufficient Flow",
    description: "The Exhaust Gas Recirculation system flow is less than expected. EGR reduces NOx emissions by recirculating exhaust gas.",
    symptoms: [
      "Check engine light on",
      "May ping/knock under load",
      "Slightly higher emissions",
    ],
    fixes: [
      "Clean carbon buildup from EGR passages and valve",
      "Check EGR valve operation (should open when vacuum applied)",
      "Inspect EGR vacuum lines",
      "Replace the EGR valve if stuck closed",
    ],
  },
  P0420: {
    code: "P0420",
    title: "Catalyst System Efficiency Below Threshold",
    description: "The catalytic converter is not converting exhaust pollutants efficiently enough. The downstream O2 sensor readings are too similar to the upstream sensor.",
    symptoms: [
      "Check engine light on",
      "May smell like rotten eggs (sulfur)",
      "Will fail emissions testing",
      "Usually no drivability symptoms",
    ],
    fixes: [
      "Rule out O2 sensor issues first (check upstream and downstream sensor readings)",
      "Check for exhaust leaks before the catalytic converter",
      "Try a catalytic converter cleaner additive",
      "Check for engine misfires or running rich (these damage cats over time)",
      "Replace the catalytic converter",
    ],
  },
  P0440: {
    code: "P0440",
    title: "EVAP System Malfunction",
    description: "The evaporative emission control system has detected a general malfunction. This system prevents fuel vapors from escaping to the atmosphere.",
    symptoms: [
      "Check engine light on",
      "Fuel smell near the car",
      "Usually no drivability symptoms",
    ],
    fixes: [
      "Check the gas cap — make sure it clicks when tightened",
      "Inspect EVAP hoses for cracks or disconnections",
      "Check the purge valve and vent valve operation",
      "Smoke test the EVAP system for leaks",
    ],
  },
  P0441: {
    code: "P0441",
    title: "EVAP System Incorrect Purge Flow",
    description: "The EVAP purge flow is not within the expected range. The purge valve may be stuck or a hose may be disconnected.",
    symptoms: [
      "Check engine light on",
      "Rough idle in some cases",
    ],
    fixes: [
      "Check purge valve hose connections",
      "Test the purge valve with a vacuum pump (should hold vacuum when off, release when powered)",
      "Replace the purge valve",
    ],
  },
  P0442: {
    code: "P0442",
    title: "EVAP System Small Leak Detected",
    description: "A small leak has been detected in the evaporative emission system. Often as simple as a loose gas cap.",
    symptoms: [
      "Check engine light on",
      "Usually no other symptoms",
    ],
    fixes: [
      "Tighten or replace the gas cap",
      "Inspect EVAP hoses and connections for small cracks",
      "Check the charcoal canister for damage",
      "Smoke test the EVAP system to pinpoint the leak",
    ],
  },
  P0443: {
    code: "P0443",
    title: "EVAP Purge Control Valve Circuit",
    description: "The circuit controlling the EVAP purge valve has an electrical fault.",
    symptoms: [
      "Check engine light on",
      "Possible rough idle",
    ],
    fixes: [
      "Check purge valve connector and wiring",
      "Test purge valve solenoid resistance",
      "Replace the purge valve",
    ],
  },
  P0452: {
    code: "P0452",
    title: "EVAP Pressure Sensor Low Input",
    description: "The fuel tank pressure sensor voltage is below the expected range.",
    symptoms: [
      "Check engine light on",
      "EVAP system may not function properly",
    ],
    fixes: [
      "Inspect the fuel tank pressure sensor connector",
      "Check wiring for shorts to ground",
      "Replace the fuel tank pressure sensor",
    ],
  },
  P0453: {
    code: "P0453",
    title: "EVAP Pressure Sensor High Input",
    description: "The fuel tank pressure sensor voltage is above the expected range, indicating an open circuit or sensor failure.",
    symptoms: [
      "Check engine light on",
    ],
    fixes: [
      "Check the fuel tank pressure sensor connector — may be unplugged",
      "Inspect wiring for open circuits",
      "Replace the fuel tank pressure sensor",
    ],
  },
  P0455: {
    code: "P0455",
    title: "EVAP System Large Leak Detected",
    description: "A large leak has been detected in the evaporative emission system. This is usually a very obvious issue like a missing gas cap.",
    symptoms: [
      "Check engine light on",
      "May smell fuel vapors",
    ],
    fixes: [
      "Check gas cap — may be missing, cracked, or not sealing",
      "Inspect EVAP hoses for obvious disconnections",
      "Check charcoal canister and vent valve",
      "Smoke test the system if visual inspection finds nothing",
    ],
  },
  P0500: {
    code: "P0500",
    title: "Vehicle Speed Sensor Malfunction",
    description: "No signal from the vehicle speed sensor. The ECU and speedometer rely on this signal.",
    symptoms: [
      "Speedometer does not work",
      "Transmission may not shift properly (automatic)",
      "Cruise control may not work",
    ],
    fixes: [
      "Check VSS connector and wiring",
      "Inspect the VSS sensor on the transmission",
      "Check for damaged tone ring or reluctor",
      "Replace the vehicle speed sensor",
    ],
  },
  P0505: {
    code: "P0505",
    title: "Idle Control System Malfunction",
    description: "The idle air control system is not maintaining the target idle speed. On Honda IACV systems this usually means a dirty or stuck valve.",
    symptoms: [
      "Idle speed fluctuates (hunting idle)",
      "Idle too high or too low",
      "Stalling when coming to a stop",
    ],
    fixes: [
      "Clean the IACV (Idle Air Control Valve) with throttle body cleaner",
      "Check for vacuum leaks around the intake",
      "Reset the ECU idle learn procedure (disconnect battery for 10 min, then idle for 10 min with AC off)",
      "Replace the IACV if cleaning doesn't help",
    ],
  },
  P0506: {
    code: "P0506",
    title: "Idle Speed Lower Than Expected",
    description: "The idle speed is below the target RPM and the ECU cannot bring it up.",
    symptoms: [
      "Low idle (below 600 RPM typically)",
      "Engine may stall at stops",
    ],
    fixes: [
      "Clean the throttle body and IACV",
      "Check for vacuum leaks",
      "Reset the ECU idle learn",
      "Replace the IACV",
    ],
  },
  P0507: {
    code: "P0507",
    title: "Idle Speed Higher Than Expected",
    description: "The idle speed is above the target RPM and the ECU cannot bring it down.",
    symptoms: [
      "High idle (above 1000 RPM typically)",
      "Engine races at idle",
    ],
    fixes: [
      "Check for vacuum leaks (a leak introduces unmetered air, raising idle)",
      "Clean the throttle body",
      "Check if the throttle cable or cruise control cable is binding",
      "Replace the IACV",
    ],
  },
  P1077: {
    code: "P1077",
    title: "Intake Manifold Runner Control Stuck Open",
    description: "Honda-specific: The intake manifold runner (butterfly valve) is stuck in the open position. On K-series engines this is part of the dual-stage intake system.",
    symptoms: [
      "Loss of low-RPM torque",
      "Check engine light on",
    ],
    fixes: [
      "Inspect the intake manifold runner actuator and linkage",
      "Check the vacuum solenoid that controls the runner",
      "Clean carbon buildup from the runner butterfly valve",
      "Replace the intake manifold runner control motor",
    ],
  },
  P1078: {
    code: "P1078",
    title: "Intake Manifold Runner Control Stuck Closed",
    description: "Honda-specific: The intake manifold runner is stuck closed, reducing high-RPM airflow.",
    symptoms: [
      "Loss of top-end power",
      "Check engine light on",
    ],
    fixes: [
      "Inspect the runner actuator linkage for binding",
      "Check vacuum supply to the actuator",
      "Clean carbon from the butterfly valve shaft",
      "Replace the runner control motor or solenoid",
    ],
  },
  P1157: {
    code: "P1157",
    title: "Air/Fuel Ratio Sensor (Bank 1 Sensor 1) Range",
    description: "Honda-specific: The wideband A/F ratio sensor output is outside the expected range. The KPro relies heavily on this sensor for fuel control.",
    symptoms: [
      "Engine runs poorly (rich or lean)",
      "Unstable idle",
      "KPro AFR reading may be stuck or erratic",
    ],
    fixes: [
      "Check the A/F sensor connector and wiring",
      "Inspect for exhaust leaks before the sensor",
      "Check sensor heater circuit (fuse and wiring)",
      "Replace the wideband A/F ratio sensor (use OEM Honda or Denso)",
    ],
  },
  P1259: {
    code: "P1259",
    title: "VTEC System Malfunction",
    description: "Honda-specific: The VTEC solenoid, oil pressure switch, or oil circuit has a problem. VTEC will not engage. This is one of the most common Honda performance codes.",
    symptoms: [
      "No VTEC engagement (noticeable power drop above 5500-6000 RPM)",
      "Check engine light on",
      "VTEC indicator does not activate on KPro",
    ],
    fixes: [
      "Check engine oil level — VTEC needs proper oil pressure to engage",
      "Change engine oil and use the correct weight (0W-20 or 5W-30 depending on model)",
      "Check the VTEC solenoid connector for corrosion",
      "Replace the VTEC solenoid gasket (common leak point on K-series)",
      "Replace the VTEC pressure switch or solenoid",
    ],
  },
  P1297: {
    code: "P1297",
    title: "Electrical Load Detector Circuit Low",
    description: "Honda-specific: The electrical load detector (ELD) signal is low. The ELD tells the ECU how much electrical load is on the alternator.",
    symptoms: [
      "Idle may fluctuate slightly",
      "Check engine light on",
      "Usually minor drivability impact",
    ],
    fixes: [
      "Check the ELD unit in the fuse box (under-hood)",
      "Inspect wiring between ELD and ECU",
      "Replace the ELD unit",
    ],
  },
  P1298: {
    code: "P1298",
    title: "Electrical Load Detector Circuit High",
    description: "Honda-specific: The ELD signal is high, indicating excessive electrical load or a sensor fault.",
    symptoms: [
      "Idle speed may change",
      "Check engine light on",
    ],
    fixes: [
      "Check for excessive electrical accessories drawing power",
      "Inspect ELD wiring and connector",
      "Replace the ELD unit",
    ],
  },
  P1361: {
    code: "P1361",
    title: "TDC Sensor Intermittent Interruption",
    description: "Honda-specific: The Top Dead Center sensor signal is cutting in and out. This sensor is critical for ignition timing.",
    symptoms: [
      "Engine may stall randomly",
      "Rough running",
      "Hard starting",
    ],
    fixes: [
      "Check TDC sensor connector and wiring harness for damage",
      "Inspect sensor for oil contamination",
      "Check sensor air gap",
      "Replace the TDC sensor/CKP sensor",
    ],
  },
  P1362: {
    code: "P1362",
    title: "TDC Sensor No Signal",
    description: "Honda-specific: No signal from the TDC sensor at all.",
    symptoms: [
      "Engine cranks but won't start",
      "No spark",
    ],
    fixes: [
      "Check TDC sensor connector — may be unplugged",
      "Inspect wiring for breaks",
      "Replace the TDC sensor",
    ],
  },
  P1381: {
    code: "P1381",
    title: "Camshaft Position Sensor Intermittent",
    description: "Honda-specific: The camshaft position sensor signal drops out intermittently.",
    symptoms: [
      "Random misfires",
      "Occasional stalling",
      "VTEC may not engage consistently",
    ],
    fixes: [
      "Check CMP sensor connector for loose pins",
      "Inspect wiring harness routing for chafing",
      "Replace the CMP sensor",
    ],
  },
  P1382: {
    code: "P1382",
    title: "Camshaft Position Sensor No Signal",
    description: "Honda-specific: No signal from the camshaft position sensor.",
    symptoms: [
      "Engine may not start",
      "No VTEC operation",
    ],
    fixes: [
      "Check CMP sensor connector",
      "Inspect timing chain/belt condition",
      "Replace the CMP sensor",
    ],
  },
  P1456: {
    code: "P1456",
    title: "EVAP Emission Control System Leak (Tank)",
    description: "Honda-specific: A leak has been detected in the fuel tank side of the EVAP system.",
    symptoms: [
      "Check engine light on",
      "Fuel smell near rear of car",
    ],
    fixes: [
      "Check and replace the gas cap",
      "Inspect fuel filler neck for cracks",
      "Check EVAP hoses at the fuel tank",
      "Smoke test the fuel tank side of the EVAP system",
    ],
  },
  P1457: {
    code: "P1457",
    title: "EVAP Emission Control System Leak (Canister)",
    description: "Honda-specific: A leak has been detected in the charcoal canister side of the EVAP system.",
    symptoms: [
      "Check engine light on",
    ],
    fixes: [
      "Inspect EVAP hoses from engine bay to canister",
      "Check the canister vent shut valve",
      "Inspect the charcoal canister for damage",
      "Smoke test the canister side of the system",
    ],
  },
  P1491: {
    code: "P1491",
    title: "EGR Valve Lift Insufficient",
    description: "Honda-specific: The EGR valve is not opening enough or not responding to the ECU command.",
    symptoms: [
      "Check engine light on",
      "Possible engine knock under load",
    ],
    fixes: [
      "Clean carbon from the EGR valve and ports",
      "Check vacuum supply to the EGR valve",
      "Test EGR valve lift sensor",
      "Replace the EGR valve",
    ],
  },
  P1519: {
    code: "P1519",
    title: "Idle Air Control Valve Circuit Failure",
    description: "Honda-specific: The IACV solenoid circuit is not responding. The ECU cannot control idle speed electronically.",
    symptoms: [
      "Erratic idle speed",
      "Stalling",
      "Idle won't come down after revving",
    ],
    fixes: [
      "Check IACV connector and wiring",
      "Clean the IACV with throttle body cleaner",
      "Test IACV solenoid resistance (should be ~10-15 ohms)",
      "Replace the IACV",
    ],
  },
  P1607: {
    code: "P1607",
    title: "ECU Internal Circuit Malfunction",
    description: "Honda-specific: The ECU has detected an internal processor fault. On KPro-equipped cars this can sometimes occur after a reflash or with power supply issues.",
    symptoms: [
      "Various warning lights",
      "Possible limp mode",
      "Random drivability issues",
    ],
    fixes: [
      "Check battery voltage (must be stable 12V+)",
      "Check ECU ground connections",
      "If running KPro, try reflashing the calibration",
      "Check ECU connector pins for corrosion or bent pins",
      "Replace ECU if fault persists",
    ],
  },
  P1671: {
    code: "P1671",
    title: "VTEC Oil Pressure Switch Circuit",
    description: "Honda-specific: The VTEC oil pressure switch circuit is open or shorted. This switch confirms that oil pressure is sufficient for VTEC engagement.",
    symptoms: [
      "VTEC will not engage",
      "Check engine light on",
      "KPro shows no VTEC activation",
    ],
    fixes: [
      "Check VTEC oil pressure switch connector",
      "Inspect wiring between the switch and ECU",
      "Verify oil pressure is adequate (may need oil pressure gauge test)",
      "Replace the VTEC oil pressure switch",
    ],
  },
  P1676: {
    code: "P1676",
    title: "VTEC Solenoid Valve Circuit",
    description: "Honda-specific: The VTEC solenoid valve circuit has an electrical fault. The solenoid cannot be activated.",
    symptoms: [
      "VTEC will not engage",
      "Check engine light on",
    ],
    fixes: [
      "Check VTEC solenoid connector for corrosion",
      "Test solenoid resistance (should be ~14-30 ohms)",
      "Check for 12V power supply to the solenoid",
      "Replace the VTEC solenoid",
    ],
  },
  P2646: {
    code: "P2646",
    title: "Rocker Arm Oil Pressure Switch Circuit Low (VTEC)",
    description: "The VTEC oil pressure is not building to the required level. Common on K-series engines when oil level is low or oil is old.",
    symptoms: [
      "VTEC does not engage",
      "Check engine light on",
      "Loss of power above VTEC crossover RPM",
    ],
    fixes: [
      "Check and top off engine oil to the correct level",
      "Change the engine oil and filter (use correct weight)",
      "Inspect the VTEC solenoid screen filter for debris",
      "Replace the VTEC solenoid gasket",
      "Replace the rocker arm oil pressure switch",
    ],
  },
  P2647: {
    code: "P2647",
    title: "Rocker Arm Oil Pressure Switch Circuit High (VTEC)",
    description: "The VTEC oil pressure switch indicates high pressure when VTEC should not be engaged.",
    symptoms: [
      "VTEC may stay engaged at low RPM",
      "Check engine light on",
      "Rough low-RPM operation",
    ],
    fixes: [
      "Check VTEC oil pressure switch wiring for shorts",
      "Inspect the VTEC solenoid for sticking",
      "Replace the VTEC oil pressure switch",
    ],
  },
  P2648: {
    code: "P2648",
    title: "Rocker Arm Actuator 'A' Control Circuit Low",
    description: "The VTEC actuator control circuit voltage is below the expected range. The ECU cannot command VTEC engagement.",
    symptoms: [
      "No VTEC engagement",
      "Check engine light on",
    ],
    fixes: [
      "Check the VTEC solenoid connector and wiring",
      "Inspect the ECU connector for the VTEC output pin",
      "Replace the VTEC solenoid",
    ],
  },
  P0010: {
    code: "P0010",
    title: "VTC Actuator Circuit (Intake Cam)",
    description: "The Variable Timing Control actuator circuit for the intake camshaft has a malfunction. The VTC system adjusts cam timing for better performance and efficiency.",
    symptoms: [
      "Check engine light on",
      "Rough idle on cold start",
      "Rattle from the VTC actuator on startup",
      "Reduced fuel economy",
    ],
    fixes: [
      "Check engine oil level and condition (VTC is oil-pressure operated)",
      "Inspect VTC solenoid connector and wiring",
      "Replace the VTC solenoid valve",
      "Replace the VTC actuator (common issue on K-series, causes cold-start rattle)",
    ],
  },
  P0011: {
    code: "P0011",
    title: "VTC System Over-Advanced (Intake Cam)",
    description: "The intake camshaft timing is more advanced than the ECU commanded. The VTC actuator may be stuck or oil passages are clogged.",
    symptoms: [
      "Rough idle",
      "Stalling on cold start",
      "Poor performance",
      "VTC actuator rattle on startup",
    ],
    fixes: [
      "Change engine oil with the correct weight and quality",
      "Clean or replace the VTC solenoid screen filter",
      "Replace the VTC solenoid",
      "Replace the VTC actuator sprocket",
    ],
  },
  P0012: {
    code: "P0012",
    title: "VTC System Retarded (Intake Cam)",
    description: "The intake camshaft timing is more retarded than the ECU commanded.",
    symptoms: [
      "Rough idle",
      "Loss of power at low RPM",
      "Increased emissions",
    ],
    fixes: [
      "Check engine oil level and condition",
      "Inspect VTC oil control valve (solenoid)",
      "Check timing chain tension",
      "Replace VTC solenoid or actuator",
    ],
  },
};

export function lookupDTC(code: string): DTCEntry | undefined {
  return dtcDatabase[code.toUpperCase()];
}

export function getAllDTCCodes(): string[] {
  return Object.keys(dtcDatabase).sort();
}
