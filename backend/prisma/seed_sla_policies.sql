-- ============================================================================
-- Enterprise SLA Policies & Category Config Migration for IT Hardware & Software
-- Laxmi Samadhan (LIFC) Ticket Portal
-- ============================================================================

DO $$
DECLARE
  v_admin_id TEXT;
  v_hw_dept_id TEXT;
  v_sw_dept_id TEXT;
  v_now TIMESTAMP := NOW();
  v_escalation_rules JSONB := '[
    {"level":"L1","trigger":"response","timeBeforeMins":15,"action":"notify","description":"L1 Helpdesk: Log ticket and initial diagnosis"},
    {"level":"L2","trigger":"resolution","timeBeforeMins":120,"action":"notify","description":"L2 Support: Troubleshoot, repair, or replace"},
    {"level":"L3","trigger":"resolution","timeBeforeMins":60,"action":"notify","description":"L3 IT Manager: 75% resolution SLA consumed, review & prioritize"},
    {"level":"L4","trigger":"resolution","timeBeforeMins":15,"action":"escalate","description":"L4 OEM / Management: SLA breached, emergency vendor/replacement action"}
  ]'::jsonb;

  v_hw_form_fields JSONB := '{
    "subCategories": [
      "Desktop",
      "Laptop",
      "Peripheral",
      "Printer",
      "Network Hardware",
      "Power / UPS",
      "Hardware Procurement & Installation",
      "Hardware Replacement",
      "Warranty & OEM Support",
      "Asset Management"
    ],
    "subIssues": {
      "Desktop": [
        "Desktop / PC not working",
        "Monitor / Display issue",
        "Hardware overheating / Fan noise",
        "RAM / HDD / SSD failure",
        "Blue screen / Hardware crash"
      ],
      "Laptop": [
        "Laptop not starting",
        "Laptop battery issue",
        "Physical damage to device"
      ],
      "Peripheral": [
        "Keyboard / Mouse not working",
        "Docking station / Adapter issue",
        "Webcam / Microphone hardware issue",
        "Peripheral / USB port issue"
      ],
      "Printer": [
        "Printer not working – critical department",
        "Printer not working – normal user"
      ],
      "Network Hardware": [
        "Network cable / LAN port hardware issue"
      ],
      "Power / UPS": [
        "UPS / Power backup issue"
      ],
      "Hardware Procurement & Installation": [
        "New hardware installation"
      ],
      "Hardware Replacement": [
        "Hardware replacement request"
      ],
      "Warranty & OEM Support": [
        "Warranty / OEM service coordination"
      ],
      "Asset Management": [
        "Hardware inventory / Asset tagging"
      ]
    },
    "items": {
      "Desktop": [
        "Desktop / PC not working",
        "Monitor / Display issue",
        "Hardware overheating / Fan noise",
        "RAM / HDD / SSD failure",
        "Blue screen / Hardware crash"
      ],
      "Laptop": [
        "Laptop not starting",
        "Laptop battery issue",
        "Physical damage to device"
      ],
      "Peripheral": [
        "Keyboard / Mouse not working",
        "Docking station / Adapter issue",
        "Webcam / Microphone hardware issue",
        "Peripheral / USB port issue"
      ],
      "Printer": [
        "Printer not working – critical department",
        "Printer not working – normal user"
      ],
      "Network Hardware": [
        "Network cable / LAN port hardware issue"
      ],
      "Power / UPS": [
        "UPS / Power backup issue"
      ],
      "Hardware Procurement & Installation": [
        "New hardware installation"
      ],
      "Hardware Replacement": [
        "Hardware replacement request"
      ],
      "Warranty & OEM Support": [
        "Warranty / OEM service coordination"
      ],
      "Asset Management": [
        "Hardware inventory / Asset tagging"
      ]
    },
    "defaultGroup": "Vendor Support-FMS"
  }'::jsonb;

  v_sw_form_fields JSONB := '{
    "subCategories": [
      "LOS (Loan Origination System)",
      "LMS (Loan Management System)",
      "CLU-collection",
      "Core Applications",
      "CRM",
      "Operating System & Drivers",
      "Productivity Software",
      "Browser & Portals",
      "Security Software",
      "Software Licenses",
      "User Permissions",
      "Reports & MIS",
      "Data Management",
      "Software Installation"
    ],
    "subIssues": {
      "LOS (Loan Origination System)": ["LOS Application Down / Critical Error"],
      "LMS (Loan Management System)": ["LMS Repayment / Disbursal Posting Error"],
      "CLU-collection": ["CLU Collection App / Receipt Sync Issue"],
      "Core Applications": ["Core Banking / Payment Gateway Sync Failure"],
      "CRM": ["CRM Customer Lead / KYC Processing Error"],
      "Operating System & Drivers": ["Operating System / Blue Screen / Corrupted OS"],
      "Productivity Software": ["Email / Outlook Access / Exchange Connection Issue"],
      "Browser & Portals": ["Digital Signature (DSC) / Java / Browser Certificate Error"],
      "Security Software": ["Antivirus / Security Patch Installation Failure"],
      "Software Licenses": ["Software License Allocation (MS Office, Adobe, etc.)"],
      "User Permissions": ["User Role / Permission Update Request"],
      "Reports & MIS": ["Custom Report / MIS Export Issue"],
      "Data Management": ["Data Correction / Rectification Request"],
      "Software Installation": ["New Software Installation Request"]
    },
    "items": {
      "LOS (Loan Origination System)": ["LOS Application Down / Critical Error"],
      "LMS (Loan Management System)": ["LMS Repayment / Disbursal Posting Error"],
      "CLU-collection": ["CLU Collection App / Receipt Sync Issue"],
      "Core Applications": ["Core Banking / Payment Gateway Sync Failure"],
      "CRM": ["CRM Customer Lead / KYC Processing Error"],
      "Operating System & Drivers": ["Operating System / Blue Screen / Corrupted OS"],
      "Productivity Software": ["Email / Outlook Access / Exchange Connection Issue"],
      "Browser & Portals": ["Digital Signature (DSC) / Java / Browser Certificate Error"],
      "Security Software": ["Antivirus / Security Patch Installation Failure"],
      "Software Licenses": ["Software License Allocation (MS Office, Adobe, etc.)"],
      "User Permissions": ["User Role / Permission Update Request"],
      "Reports & MIS": ["Custom Report / MIS Export Issue"],
      "Data Management": ["Data Correction / Rectification Request"],
      "Software Installation": ["New Software Installation Request"]
    },
    "defaultGroup": "Internal IT Support"
  }'::jsonb;

BEGIN
  -- 1. Identify Admin User for creator FK
  SELECT id INTO v_admin_id FROM "User" WHERE role IN ('SUPER_ADMIN', 'ADMIN') ORDER BY "createdAt" ASC LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM "User" ORDER BY "createdAt" ASC LIMIT 1;
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No user found in User table to associate as creator.';
  END IF;

  -- 2. Ensure IT Hardware Department exists
  SELECT id INTO v_hw_dept_id FROM "Department" 
  WHERE name = 'IT Hardware' OR name ILIKE '%Hardware%' OR type ILIKE '%Hardware%' 
  ORDER BY "createdAt" ASC LIMIT 1;

  IF v_hw_dept_id IS NULL THEN
    v_hw_dept_id := gen_random_uuid()::text;
    INSERT INTO "Department" (id, name, type, description, color, icon, "updatedAt")
    VALUES (v_hw_dept_id, 'IT Hardware', 'IT Hardware', 'Hardware procurement, maintenance, repair, and support', '#3B82F6', 'computer', v_now);
  END IF;

  -- 3. Ensure IT Software Department exists
  SELECT id INTO v_sw_dept_id FROM "Department" 
  WHERE name = 'IT Software' OR name ILIKE '%Software%' OR type ILIKE '%Software%' 
  ORDER BY "createdAt" ASC LIMIT 1;

  IF v_sw_dept_id IS NULL THEN
    v_sw_dept_id := gen_random_uuid()::text;
    INSERT INTO "Department" (id, name, type, description, color, icon, "updatedAt")
    VALUES (v_sw_dept_id, 'IT Software', 'IT Software', 'Software licenses, installations, LOS/LMS, and SaaS management', '#8B5CF6', 'code', v_now);
  END IF;

  -- 4. Upsert TicketCategoryConfig for IT Hardware
  INSERT INTO "TicketCategoryConfig" (id, "departmentId", category, "isActive", "defaultPriority", "formFields", "updatedAt")
  VALUES 
    (gen_random_uuid()::text, v_hw_dept_id, 'HARDWARE_REQUEST', true, 'MEDIUM', v_hw_form_fields, v_now),
    (gen_random_uuid()::text, v_hw_dept_id, 'INCIDENT', true, 'MEDIUM', v_hw_form_fields, v_now),
    (gen_random_uuid()::text, v_hw_dept_id, 'SERVICE_REQUEST', true, 'MEDIUM', v_hw_form_fields, v_now)
  ON CONFLICT ("departmentId", category) DO UPDATE SET
    "formFields" = EXCLUDED."formFields",
    "isActive" = true,
    "updatedAt" = v_now;

  -- 5. Upsert TicketCategoryConfig for IT Software
  INSERT INTO "TicketCategoryConfig" (id, "departmentId", category, "isActive", "defaultPriority", "formFields", "updatedAt")
  VALUES 
    (gen_random_uuid()::text, v_sw_dept_id, 'SOFTWARE_REQUEST', true, 'MEDIUM', v_sw_form_fields, v_now),
    (gen_random_uuid()::text, v_sw_dept_id, 'INCIDENT', true, 'MEDIUM', v_sw_form_fields, v_now),
    (gen_random_uuid()::text, v_sw_dept_id, 'SERVICE_REQUEST', true, 'MEDIUM', v_sw_form_fields, v_now)
  ON CONFLICT ("departmentId", category) DO UPDATE SET
    "formFields" = EXCLUDED."formFields",
    "isActive" = true,
    "updatedAt" = v_now;

  -- 6. Upsert 20 IT Hardware Sub-Issue SLA Policies
  INSERT INTO "SLAPolicy" (id, name, "departmentId", category, "subCategory", priority, "responseTimeMins", "resolutionTimeMins", "businessHoursOnly", "excludesWeekends", "escalationRules", description, "isActive", "createdById", "updatedAt")
  VALUES
    (gen_random_uuid()::text, 'HW: Desktop / PC not working', v_hw_dept_id, 'HARDWARE_REQUEST', 'Desktop / PC not working', 'CRITICAL', 15, 240, true, true, v_escalation_rules, 'Business-critical PC failure stopping work', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Laptop not starting', v_hw_dept_id, 'HARDWARE_REQUEST', 'Laptop not starting', 'HIGH', 30, 240, true, true, v_escalation_rules, 'One user essential laptop work blocked', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Keyboard / Mouse not working', v_hw_dept_id, 'HARDWARE_REQUEST', 'Keyboard / Mouse not working', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Input device failure with potential temporary workaround', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Monitor / Display issue', v_hw_dept_id, 'HARDWARE_REQUEST', 'Monitor / Display issue', 'HIGH', 30, 240, true, true, v_escalation_rules, 'Display output / monitor blank or flickering', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Printer not working – critical department', v_hw_dept_id, 'HARDWARE_REQUEST', 'Printer not working – critical department', 'CRITICAL', 15, 120, true, true, v_escalation_rules, 'Disbursal / Cash / Legal printing blocked in critical department', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Printer not working – normal user', v_hw_dept_id, 'HARDWARE_REQUEST', 'Printer not working – normal user', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'General user printing issue', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Network cable / LAN port hardware issue', v_hw_dept_id, 'HARDWARE_REQUEST', 'Network cable / LAN port hardware issue', 'HIGH', 30, 240, true, true, v_escalation_rules, 'Physical LAN / Cable / Port connectivity broken', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Docking station / Adapter issue', v_hw_dept_id, 'HARDWARE_REQUEST', 'Docking station / Adapter issue', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Docking station or power adapter connectivity problem', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: UPS / Power backup issue', v_hw_dept_id, 'HARDWARE_REQUEST', 'UPS / Power backup issue', 'HIGH', 30, 240, true, true, v_escalation_rules, 'UPS or power backup failure risking data loss / outage', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Hardware overheating / Fan noise', v_hw_dept_id, 'HARDWARE_REQUEST', 'Hardware overheating / Fan noise', 'HIGH', 30, 240, true, true, v_escalation_rules, 'Excessive thermal heating or cooling fan malfunction', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: RAM / HDD / SSD failure', v_hw_dept_id, 'HARDWARE_REQUEST', 'RAM / HDD / SSD failure', 'HIGH', 30, 480, true, true, v_escalation_rules, 'Storage or memory hardware crash / bad sectors', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Blue screen / Hardware crash', v_hw_dept_id, 'HARDWARE_REQUEST', 'Blue screen / Hardware crash', 'HIGH', 30, 240, true, true, v_escalation_rules, 'BSOD / Kernel hardware trap failure', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Webcam / Microphone hardware issue', v_hw_dept_id, 'HARDWARE_REQUEST', 'Webcam / Microphone hardware issue', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Audio / Video recording or conference hardware problem', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Laptop battery issue', v_hw_dept_id, 'HARDWARE_REQUEST', 'Laptop battery issue', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Battery health critical / rapid discharge', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Physical damage to device', v_hw_dept_id, 'HARDWARE_REQUEST', 'Physical damage to device', 'MEDIUM', 120, 1440, true, true, v_escalation_rules, 'Chassis / Screen / Hinge physical crack or drop damage', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: New hardware installation', v_hw_dept_id, 'HARDWARE_REQUEST', 'New hardware installation', 'LOW', 240, 2880, true, true, v_escalation_rules, 'Planned installation and configuration of new equipment', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Hardware replacement request', v_hw_dept_id, 'HARDWARE_REQUEST', 'Hardware replacement request', 'MEDIUM', 60, 1440, true, true, v_escalation_rules, 'Replacement of end-of-life or damaged hardware', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Warranty / OEM service coordination', v_hw_dept_id, 'HARDWARE_REQUEST', 'Warranty / OEM service coordination', 'MEDIUM', 120, 4320, true, true, v_escalation_rules, 'OEM vendor on-site service call and part procurement', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Hardware inventory / Asset tagging', v_hw_dept_id, 'HARDWARE_REQUEST', 'Hardware inventory / Asset tagging', 'LOW', 240, 2880, true, true, v_escalation_rules, 'Physical audit and barcode/QR asset tagging', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'HW: Peripheral / USB port issue', v_hw_dept_id, 'HARDWARE_REQUEST', 'Peripheral / USB port issue', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Faulty USB connector or external peripheral device', true, v_admin_id, v_now)
  ON CONFLICT (name) DO UPDATE SET
    "departmentId" = EXCLUDED."departmentId",
    category = EXCLUDED.category,
    "subCategory" = EXCLUDED."subCategory",
    priority = EXCLUDED.priority,
    "responseTimeMins" = EXCLUDED."responseTimeMins",
    "resolutionTimeMins" = EXCLUDED."resolutionTimeMins",
    "businessHoursOnly" = EXCLUDED."businessHoursOnly",
    "excludesWeekends" = EXCLUDED."excludesWeekends",
    "escalationRules" = EXCLUDED."escalationRules",
    description = EXCLUDED.description,
    "isActive" = true,
    "updatedAt" = v_now;

  -- 7. Upsert 4 IT Hardware Fallback Policies
  INSERT INTO "SLAPolicy" (id, name, "departmentId", category, "subCategory", priority, "responseTimeMins", "resolutionTimeMins", "businessHoursOnly", "excludesWeekends", "escalationRules", description, "isActive", "createdById", "updatedAt")
  VALUES
    (gen_random_uuid()::text, 'IT Hardware - Critical (P1) Fallback', v_hw_dept_id, NULL, NULL, 'CRITICAL', 15, 120, true, true, v_escalation_rules, 'Hardware Critical Priority Fallback', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'IT Hardware - High (P2) Fallback', v_hw_dept_id, NULL, NULL, 'HIGH', 30, 240, true, true, v_escalation_rules, 'Hardware High Priority Fallback', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'IT Hardware - Medium (P3) Fallback', v_hw_dept_id, NULL, NULL, 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Hardware Medium Priority Fallback', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'IT Hardware - Low (P4) Fallback', v_hw_dept_id, NULL, NULL, 'LOW', 240, 2880, true, true, v_escalation_rules, 'Hardware Low Priority Fallback', true, v_admin_id, v_now)
  ON CONFLICT (name) DO UPDATE SET
    "departmentId" = EXCLUDED."departmentId",
    priority = EXCLUDED.priority,
    "responseTimeMins" = EXCLUDED."responseTimeMins",
    "resolutionTimeMins" = EXCLUDED."resolutionTimeMins",
    "isActive" = true,
    "updatedAt" = v_now;

  -- 8. Upsert 14 IT Software Sub-Issue SLA Policies
  INSERT INTO "SLAPolicy" (id, name, "departmentId", category, "subCategory", priority, "responseTimeMins", "resolutionTimeMins", "businessHoursOnly", "excludesWeekends", "escalationRules", description, "isActive", "createdById", "updatedAt")
  VALUES
    (gen_random_uuid()::text, 'SW: LOS Application Down / Critical Error', v_sw_dept_id, 'SOFTWARE_REQUEST', 'LOS Application Down / Critical Error', 'CRITICAL', 15, 120, true, true, v_escalation_rules, 'Core lending LOS portal unavailable or customer application stuck', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: LMS Repayment / Disbursal Posting Error', v_sw_dept_id, 'SOFTWARE_REQUEST', 'LMS Repayment / Disbursal Posting Error', 'CRITICAL', 15, 120, true, true, v_escalation_rules, 'Loan disbursal or EMI repayment transaction failure in LMS', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: CLU Collection App / Receipt Sync Issue', v_sw_dept_id, 'SOFTWARE_REQUEST', 'CLU Collection App / Receipt Sync Issue', 'CRITICAL', 15, 120, true, true, v_escalation_rules, 'Collection agent mobile receipt generation or banking sync failure', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Core Banking / Payment Gateway Sync Failure', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Core Banking / Payment Gateway Sync Failure', 'CRITICAL', 15, 120, true, true, v_escalation_rules, 'Integration failure with banking partner or payment gateway', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: CRM Customer Lead / KYC Processing Error', v_sw_dept_id, 'SOFTWARE_REQUEST', 'CRM Customer Lead / KYC Processing Error', 'HIGH', 30, 240, true, true, v_escalation_rules, 'KYC validation or lead allocation failure in CRM', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Operating System / Blue Screen / Corrupted OS', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Operating System / Blue Screen / Corrupted OS', 'HIGH', 30, 240, true, true, v_escalation_rules, 'OS corruption, BitLocker lock, or system software failure', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Email / Outlook Access / Exchange Connection Issue', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Email / Outlook Access / Exchange Connection Issue', 'HIGH', 30, 240, true, true, v_escalation_rules, 'Corporate email or MS Outlook communication down for user', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Digital Signature (DSC) / Java / Browser Certificate Error', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Digital Signature (DSC) / Java / Browser Certificate Error', 'HIGH', 30, 240, true, true, v_escalation_rules, 'Class 3 DSC token, Java runtime, or banking portal certificate issue', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Antivirus / Security Patch Installation Failure', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Antivirus / Security Patch Installation Failure', 'HIGH', 30, 240, true, true, v_escalation_rules, 'EDR / Antivirus agent broken or mandatory security update failed', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Software License Allocation (MS Office, Adobe, etc.)', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Software License Allocation (MS Office, Adobe, etc.)', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Provisioning or license key activation for productivity tools', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: User Role / Permission Update Request', v_sw_dept_id, 'SOFTWARE_REQUEST', 'User Role / Permission Update Request', 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Branch or employee role entitlement update in business applications', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Custom Report / MIS Export Issue', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Custom Report / MIS Export Issue', 'MEDIUM', 60, 1440, true, true, v_escalation_rules, 'Scheduled financial / regulatory report generation latency', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: Data Correction / Rectification Request', v_sw_dept_id, 'SOFTWARE_REQUEST', 'Data Correction / Rectification Request', 'MEDIUM', 60, 1440, true, true, v_escalation_rules, 'Approved data value correction in core loan database', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'SW: New Software Installation Request', v_sw_dept_id, 'SOFTWARE_REQUEST', 'New Software Installation Request', 'LOW', 240, 2880, true, true, v_escalation_rules, 'Standard software installation request with approved business justification', true, v_admin_id, v_now)
  ON CONFLICT (name) DO UPDATE SET
    "departmentId" = EXCLUDED."departmentId",
    category = EXCLUDED.category,
    "subCategory" = EXCLUDED."subCategory",
    priority = EXCLUDED.priority,
    "responseTimeMins" = EXCLUDED."responseTimeMins",
    "resolutionTimeMins" = EXCLUDED."resolutionTimeMins",
    "businessHoursOnly" = EXCLUDED."businessHoursOnly",
    "excludesWeekends" = EXCLUDED."excludesWeekends",
    "escalationRules" = EXCLUDED."escalationRules",
    description = EXCLUDED.description,
    "isActive" = true,
    "updatedAt" = v_now;

  -- 9. Upsert 4 IT Software Fallback Policies
  INSERT INTO "SLAPolicy" (id, name, "departmentId", category, "subCategory", priority, "responseTimeMins", "resolutionTimeMins", "businessHoursOnly", "excludesWeekends", "escalationRules", description, "isActive", "createdById", "updatedAt")
  VALUES
    (gen_random_uuid()::text, 'IT Software - Critical (P1) Fallback', v_sw_dept_id, NULL, NULL, 'CRITICAL', 15, 120, true, true, v_escalation_rules, 'Software Critical Priority Fallback', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'IT Software - High (P2) Fallback', v_sw_dept_id, NULL, NULL, 'HIGH', 30, 240, true, true, v_escalation_rules, 'Software High Priority Fallback', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'IT Software - Medium (P3) Fallback', v_sw_dept_id, NULL, NULL, 'MEDIUM', 60, 480, true, true, v_escalation_rules, 'Software Medium Priority Fallback', true, v_admin_id, v_now),
    (gen_random_uuid()::text, 'IT Software - Low (P4) Fallback', v_sw_dept_id, NULL, NULL, 'LOW', 240, 2880, true, true, v_escalation_rules, 'Software Low Priority Fallback', true, v_admin_id, v_now)
  ON CONFLICT (name) DO UPDATE SET
    "departmentId" = EXCLUDED."departmentId",
    priority = EXCLUDED.priority,
    "responseTimeMins" = EXCLUDED."responseTimeMins",
    "resolutionTimeMins" = EXCLUDED."resolutionTimeMins",
    "isActive" = true,
    "updatedAt" = v_now;

  RAISE NOTICE '✅ Successfully completed IT Hardware & Software SLA policy configuration.';
END $$;
