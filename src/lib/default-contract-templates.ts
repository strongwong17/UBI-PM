import type { ContractTemplate } from "./contract-types";

export const DEFAULT_CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "tpl-service-agreement",
    name: "Service Agreement",
    description:
      "Standard service agreement between a service provider and client.",
    category: "service-agreement",
    content: `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of {{effective_date}} ("Effective Date") by and between:

SERVICE PROVIDER:
{{provider_company_name}}
Address: {{provider_address}}
Contact: {{provider_contact_name}}
Email: {{provider_email}}

CLIENT:
{{client_company_name}}
Address: {{client_address}}
Contact: {{client_contact_name}}
Email: {{client_email}}

1. SERVICES
The Service Provider agrees to provide the following services ("Services"):
{{service_description}}

2. TERM
This Agreement shall commence on {{start_date}} and continue until {{end_date}}, unless terminated earlier in accordance with Section 7.

3. COMPENSATION
The Client agrees to pay the Service Provider a total fee of \${{total_amount}} for the Services, payable as follows:
{{payment_terms}}

4. DELIVERABLES
The Service Provider shall deliver the following:
{{deliverables}}

5. CONFIDENTIALITY
Both parties agree to maintain the confidentiality of any proprietary or confidential information disclosed during the course of this Agreement.

6. INTELLECTUAL PROPERTY
All work product created by the Service Provider in the performance of this Agreement shall be the property of {{ip_owner}}.

7. TERMINATION
Either party may terminate this Agreement with {{notice_period}} days' written notice. In the event of termination, the Client shall pay for all Services rendered up to the date of termination.

8. LIMITATION OF LIABILITY
Neither party shall be liable for any indirect, incidental, or consequential damages arising out of this Agreement.

9. GOVERNING LAW
This Agreement shall be governed by the laws of {{governing_state}}.

10. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.


_________________________________
{{provider_contact_name}}
{{provider_company_name}}
Date: _______________


_________________________________
{{client_contact_name}}
{{client_company_name}}
Date: _______________

See {{exhibit_a_label}} attached hereto and incorporated herein by reference.`,
    exhibits: [
      {
        id: "ex-a-service",
        label: "Exhibit A",
        title: "Detailed Scope of Services",
        content: `The following details the specific services, deliverables, and performance standards referenced in the Agreement:

1. DETAILED SERVICE DESCRIPTION
{{exhibit_a_services_detail}}

2. SERVICE LEVELS & PERFORMANCE STANDARDS
{{exhibit_a_service_levels}}

3. KEY PERSONNEL
{{exhibit_a_key_personnel}}

4. REPORTING REQUIREMENTS
{{exhibit_a_reporting}}`,
      },
    ],
    placeholders: [
      { key: "effective_date", label: "Effective Date", type: "date", required: true },
      { key: "provider_company_name", label: "Provider Company Name", type: "text", required: true },
      { key: "provider_address", label: "Provider Address", type: "text", required: true },
      { key: "provider_contact_name", label: "Provider Contact Name", type: "text", required: true },
      { key: "provider_email", label: "Provider Email", type: "text", required: true },
      { key: "client_company_name", label: "Client Company Name", type: "text", required: true },
      { key: "client_address", label: "Client Address", type: "text", required: true },
      { key: "client_contact_name", label: "Client Contact Name", type: "text", required: true },
      { key: "client_email", label: "Client Email", type: "text", required: true },
      { key: "service_description", label: "Service Description", type: "textarea", required: true },
      { key: "start_date", label: "Start Date", type: "date", required: true },
      { key: "end_date", label: "End Date", type: "date", required: true },
      { key: "total_amount", label: "Total Amount", type: "number", required: true },
      { key: "payment_terms", label: "Payment Terms", type: "textarea", required: true },
      { key: "deliverables", label: "Deliverables", type: "textarea", required: true },
      { key: "ip_owner", label: "IP Owner", type: "text", required: true },
      { key: "notice_period", label: "Notice Period (Days)", type: "number", required: true },
      { key: "governing_state", label: "Governing State/Jurisdiction", type: "text", required: true },
      { key: "exhibit_a_label", label: "Exhibit A Label", type: "text", required: false, defaultValue: "Exhibit A" },
      { key: "exhibit_a_services_detail", label: "Exhibit A: Detailed Services", type: "textarea", required: false },
      { key: "exhibit_a_service_levels", label: "Exhibit A: Service Levels", type: "textarea", required: false },
      { key: "exhibit_a_key_personnel", label: "Exhibit A: Key Personnel", type: "textarea", required: false },
      { key: "exhibit_a_reporting", label: "Exhibit A: Reporting Requirements", type: "textarea", required: false },
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "tpl-sow",
    name: "Statement of Work",
    description:
      "Detailed statement of work defining project scope, milestones, and deliverables.",
    category: "sow",
    content: `STATEMENT OF WORK (SOW)

SOW Reference: {{sow_reference}}
Date: {{sow_date}}

PARTIES:
Provider: {{provider_company_name}}
Client: {{client_company_name}}

1. PROJECT OVERVIEW
{{project_overview}}

2. OBJECTIVES
{{project_objectives}}

3. SCOPE OF WORK
{{scope_of_work}}

4. DELIVERABLES
{{deliverables}}

5. MILESTONES & TIMELINE

Milestone 1: {{milestone_1_name}}
  Due Date: {{milestone_1_date}}
  Description: {{milestone_1_description}}

Milestone 2: {{milestone_2_name}}
  Due Date: {{milestone_2_date}}
  Description: {{milestone_2_description}}

Milestone 3: {{milestone_3_name}}
  Due Date: {{milestone_3_date}}
  Description: {{milestone_3_description}}

6. BUDGET
Total Project Cost: \${{total_cost}}
Payment Schedule: {{payment_schedule}}

7. ASSUMPTIONS
{{assumptions}}

8. ACCEPTANCE CRITERIA
{{acceptance_criteria}}

9. CHANGE MANAGEMENT
Any changes to this SOW must be agreed upon in writing by both parties. Changes may affect the timeline and budget.

10. POINT OF CONTACT
Provider Contact: {{provider_contact_name}} ({{provider_email}})
Client Contact: {{client_contact_name}} ({{client_email}})


APPROVED BY:

_________________________________
{{provider_contact_name}}, {{provider_company_name}}
Date: _______________

_________________________________
{{client_contact_name}}, {{client_company_name}}
Date: _______________`,
    exhibits: [],
    placeholders: [
      { key: "sow_reference", label: "SOW Reference Number", type: "text", required: true },
      { key: "sow_date", label: "SOW Date", type: "date", required: true },
      { key: "provider_company_name", label: "Provider Company Name", type: "text", required: true },
      { key: "client_company_name", label: "Client Company Name", type: "text", required: true },
      { key: "project_overview", label: "Project Overview", type: "textarea", required: true },
      { key: "project_objectives", label: "Project Objectives", type: "textarea", required: true },
      { key: "scope_of_work", label: "Scope of Work", type: "textarea", required: true },
      { key: "deliverables", label: "Deliverables", type: "textarea", required: true },
      { key: "milestone_1_name", label: "Milestone 1 Name", type: "text", required: true },
      { key: "milestone_1_date", label: "Milestone 1 Date", type: "date", required: true },
      { key: "milestone_1_description", label: "Milestone 1 Description", type: "textarea", required: true },
      { key: "milestone_2_name", label: "Milestone 2 Name", type: "text", required: true },
      { key: "milestone_2_date", label: "Milestone 2 Date", type: "date", required: true },
      { key: "milestone_2_description", label: "Milestone 2 Description", type: "textarea", required: true },
      { key: "milestone_3_name", label: "Milestone 3 Name", type: "text", required: true },
      { key: "milestone_3_date", label: "Milestone 3 Date", type: "date", required: true },
      { key: "milestone_3_description", label: "Milestone 3 Description", type: "textarea", required: true },
      { key: "total_cost", label: "Total Cost", type: "number", required: true },
      { key: "payment_schedule", label: "Payment Schedule", type: "textarea", required: true },
      { key: "assumptions", label: "Assumptions", type: "textarea", required: true },
      { key: "acceptance_criteria", label: "Acceptance Criteria", type: "textarea", required: true },
      { key: "provider_contact_name", label: "Provider Contact Name", type: "text", required: true },
      { key: "provider_email", label: "Provider Email", type: "text", required: true },
      { key: "client_contact_name", label: "Client Contact Name", type: "text", required: true },
      { key: "client_email", label: "Client Email", type: "text", required: true },
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "tpl-vendor",
    name: "Vendor Contract",
    description:
      "Agreement for engaging vendors and suppliers for goods or services.",
    category: "vendor",
    content: `VENDOR AGREEMENT

This Vendor Agreement ("Agreement") is made effective as of {{effective_date}} by and between:

COMPANY:
{{company_name}}
Address: {{company_address}}

VENDOR:
{{vendor_name}}
Address: {{vendor_address}}
Tax ID/EIN: {{vendor_tax_id}}

1. GOODS/SERVICES
The Vendor agrees to supply the following goods/services:
{{goods_services_description}}

2. PRICING & PAYMENT
Unit Price/Rate: \${{unit_price}}
Estimated Total: \${{estimated_total}}
Payment Terms: {{payment_terms}}
Invoice Frequency: {{invoice_frequency}}

3. DELIVERY
Delivery Schedule: {{delivery_schedule}}
Delivery Location: {{delivery_location}}

4. TERM
This Agreement begins on {{start_date}} and continues until {{end_date}}.

5. QUALITY STANDARDS
The Vendor shall ensure all goods/services meet the following standards:
{{quality_standards}}

6. WARRANTIES
The Vendor warrants that all goods/services shall be free from defects and conform to the specifications outlined in this Agreement for a period of {{warranty_period}}.

7. INDEMNIFICATION
The Vendor shall indemnify and hold harmless the Company from any claims arising from the Vendor's performance under this Agreement.

8. TERMINATION
Either party may terminate this Agreement with {{notice_period}} days' written notice.

9. GOVERNING LAW
This Agreement shall be governed by the laws of {{governing_state}}.


_________________________________
{{company_name}} — Authorized Representative
Date: _______________

_________________________________
{{vendor_name}} — Authorized Representative
Date: _______________`,
    exhibits: [],
    placeholders: [
      { key: "effective_date", label: "Effective Date", type: "date", required: true },
      { key: "company_name", label: "Company Name", type: "text", required: true },
      { key: "company_address", label: "Company Address", type: "text", required: true },
      { key: "vendor_name", label: "Vendor Name", type: "text", required: true },
      { key: "vendor_address", label: "Vendor Address", type: "text", required: true },
      { key: "vendor_tax_id", label: "Vendor Tax ID/EIN", type: "text", required: true },
      { key: "goods_services_description", label: "Goods/Services Description", type: "textarea", required: true },
      { key: "unit_price", label: "Unit Price/Rate", type: "number", required: true },
      { key: "estimated_total", label: "Estimated Total", type: "number", required: true },
      { key: "payment_terms", label: "Payment Terms", type: "textarea", required: true },
      { key: "invoice_frequency", label: "Invoice Frequency", type: "text", required: true },
      { key: "delivery_schedule", label: "Delivery Schedule", type: "textarea", required: true },
      { key: "delivery_location", label: "Delivery Location", type: "text", required: true },
      { key: "start_date", label: "Start Date", type: "date", required: true },
      { key: "end_date", label: "End Date", type: "date", required: true },
      { key: "quality_standards", label: "Quality Standards", type: "textarea", required: true },
      { key: "warranty_period", label: "Warranty Period", type: "text", required: true },
      { key: "notice_period", label: "Notice Period (Days)", type: "number", required: true },
      { key: "governing_state", label: "Governing State/Jurisdiction", type: "text", required: true },
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "tpl-nda",
    name: "Non-Disclosure Agreement",
    description: "Mutual NDA for protecting confidential business information.",
    category: "nda",
    content: `MUTUAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of {{effective_date}} by and between:

PARTY A:
{{party_a_name}}
Address: {{party_a_address}}

PARTY B:
{{party_b_name}}
Address: {{party_b_address}}

PURPOSE:
{{purpose}}

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public information disclosed by either party to the other, including but not limited to: business plans, financial data, technical specifications, customer lists, trade secrets, and any other information marked as confidential or that reasonably should be understood to be confidential.

2. OBLIGATIONS
Each party agrees to:
a) Hold all Confidential Information in strict confidence
b) Not disclose Confidential Information to any third party without prior written consent
c) Use Confidential Information solely for the Purpose stated above
d) Protect Confidential Information with at least the same degree of care used to protect its own confidential information

3. EXCLUSIONS
This Agreement does not apply to information that:
a) Is or becomes publicly available through no fault of the receiving party
b) Was already known to the receiving party prior to disclosure
c) Is independently developed without use of Confidential Information
d) Is required to be disclosed by law or court order

4. TERM
This Agreement shall remain in effect for {{term_years}} year(s) from the Effective Date. Obligations of confidentiality shall survive termination for an additional {{survival_years}} year(s).

5. RETURN OF INFORMATION
Upon termination or request, each party shall promptly return or destroy all Confidential Information and certify such destruction in writing.

6. REMEDIES
Both parties acknowledge that breach of this Agreement may cause irreparable harm, and the non-breaching party shall be entitled to seek injunctive relief in addition to any other remedies.

7. GOVERNING LAW
This Agreement shall be governed by the laws of {{governing_state}}.

8. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement regarding confidentiality between the parties.


_________________________________
{{party_a_name}} — Authorized Signatory
Name: {{party_a_signatory}}
Title: {{party_a_title}}
Date: _______________

_________________________________
{{party_b_name}} — Authorized Signatory
Name: {{party_b_signatory}}
Title: {{party_b_title}}
Date: _______________`,
    exhibits: [],
    placeholders: [
      { key: "effective_date", label: "Effective Date", type: "date", required: true },
      { key: "party_a_name", label: "Party A Name", type: "text", required: true },
      { key: "party_a_address", label: "Party A Address", type: "text", required: true },
      { key: "party_b_name", label: "Party B Name", type: "text", required: true },
      { key: "party_b_address", label: "Party B Address", type: "text", required: true },
      { key: "purpose", label: "Purpose of NDA", type: "textarea", required: true },
      { key: "term_years", label: "Term (Years)", type: "number", required: true },
      { key: "survival_years", label: "Survival Period (Years)", type: "number", required: true },
      { key: "governing_state", label: "Governing State/Jurisdiction", type: "text", required: true },
      { key: "party_a_signatory", label: "Party A Signatory Name", type: "text", required: true },
      { key: "party_a_title", label: "Party A Signatory Title", type: "text", required: true },
      { key: "party_b_signatory", label: "Party B Signatory Name", type: "text", required: true },
      { key: "party_b_title", label: "Party B Signatory Title", type: "text", required: true },
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];
