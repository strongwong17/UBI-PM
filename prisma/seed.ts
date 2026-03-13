import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Business Profile
  await prisma.businessProfile.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "UBInsights LLC",
      address: "28016 Ridgebluff Ct\nRancho Palos Verdes, CA 90275",
      email: "yushi@ubinsights.com",
      phone: "310 906 5677",
      tagline: "UX Research Consulting",
    },
  });

  // Users
  const admin = await prisma.user.upsert({
    where: { email: "yushi@ubinsights.com" },
    update: {},
    create: {
      email: "yushi@ubinsights.com",
      name: "Yushi",
      passwordHash: hashSync("ubi12345", 10),
      role: "ADMIN",
    },
  });
  console.log("Created admin user:", admin.email);

  // Estimate templates
  await prisma.estimateTemplate.create({
    data: {
      name: "Focus Group Study",
      description: "Standard focus group with recruitment, moderation, venue, and reporting",
      pricingModel: "MIXED",
      phases: {
        create: [
          {
            name: "Recruitment",
            description: "Participant screening and recruitment",
            sortOrder: 0,
            lineItems: {
              create: [
                { description: "Participant Recruitment", unit: "participants", defaultQuantity: 8, defaultPrice: 800, sortOrder: 0 },
                { description: "Screener Design & Management", unit: "fixed", defaultQuantity: 1, defaultPrice: 3000, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Fieldwork",
            description: "Moderation sessions",
            sortOrder: 1,
            lineItems: {
              create: [
                { description: "Moderation Sessions", unit: "sessions", defaultQuantity: 2, defaultPrice: 8000, sortOrder: 0 },
                { description: "Simultaneous Translation", unit: "days", defaultQuantity: 1, defaultPrice: 5000, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Logistics",
            description: "Venue and logistics",
            sortOrder: 2,
            lineItems: {
              create: [
                { description: "Venue Hire", unit: "days", defaultQuantity: 1, defaultPrice: 12000, sortOrder: 0 },
                { description: "Participant Incentives", unit: "participants", defaultQuantity: 8, defaultPrice: 600, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Reporting",
            description: "Analysis and report",
            sortOrder: 3,
            lineItems: {
              create: [
                { description: "Report Writing", unit: "days", defaultQuantity: 3, defaultPrice: 5000, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Project Management",
            description: "Overall project coordination",
            sortOrder: 4,
            lineItems: {
              create: [
                { description: "Project Management", unit: "days", defaultQuantity: 5, defaultPrice: 2000, sortOrder: 0 },
              ],
            },
          },
        ],
      },
    },
  });
  console.log("Created template: Focus Group Study");

  await prisma.estimateTemplate.create({
    data: {
      name: "In-Depth Interviews",
      description: "Remote or in-person IDI with recruitment and reporting",
      pricingModel: "MIXED",
      phases: {
        create: [
          {
            name: "Recruitment",
            sortOrder: 0,
            lineItems: {
              create: [
                { description: "Participant Recruitment", unit: "participants", defaultQuantity: 12, defaultPrice: 600, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Fieldwork",
            sortOrder: 1,
            lineItems: {
              create: [
                { description: "Moderation Sessions", unit: "sessions", defaultQuantity: 12, defaultPrice: 3000, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Incentives",
            sortOrder: 2,
            lineItems: {
              create: [
                { description: "Participant Incentives", unit: "participants", defaultQuantity: 12, defaultPrice: 400, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Reporting",
            sortOrder: 3,
            lineItems: {
              create: [
                { description: "Report Writing", unit: "days", defaultQuantity: 4, defaultPrice: 5000, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Project Management",
            sortOrder: 4,
            lineItems: {
              create: [
                { description: "Project Management", unit: "days", defaultQuantity: 4, defaultPrice: 2000, sortOrder: 0 },
              ],
            },
          },
        ],
      },
    },
  });
  console.log("Created template: In-Depth Interviews");

  // Sample client
  const client = await prisma.client.create({
    data: {
      company: "Natura Beauty Group",
      industry: "Beauty & Personal Care",
      email: "projects@naturabeauty.cn",
      phone: "+86 10 6888 0000",
      notes: "Key account — skincare and haircare studies",
      billingName: "Natura Beauty Group Co. Ltd.",
      billingAddress: "25F Tower B, China Central Place\nChaoyang District, Beijing 100025",
      billingEmail: "finance@naturabeauty.cn",
      taxId: "91110000100000000X",
      contacts: {
        create: [
          { name: "Liu Wei", title: "Consumer Insights Manager", email: "liu.wei@naturabeauty.cn", phone: "+86 138 0000 1111", isPrimary: true },
          { name: "Chen Fang", title: "Senior Brand Manager", email: "chen.fang@naturabeauty.cn", isPrimary: false },
        ],
      },
    },
    include: { contacts: true },
  });
  console.log("Created client:", client.company);

  // Sample project with inquiry, estimate, and invoice
  const year = new Date().getFullYear();
  const project = await prisma.project.create({
    data: {
      projectNumber: `PRJ-${year}-001`,
      title: "Skincare Usage & Attitude Study Q1",
      status: "IN_PROGRESS",
      executionPhase: "FIELDWORK",
      notes: "4 focus groups across Beijing and Shanghai",
      clientId: client.id,
      primaryContactId: client.contacts[0].id,
      assignedToId: admin.id,
    },
  });
  console.log("Created project:", project.projectNumber);

  // Inquiry for the project
  await prisma.inquiry.create({
    data: {
      projectId: project.id,
      background: "Natura is launching a new anti-aging skincare line targeting urban women 30-45.",
      objectives: "Understand current skincare routines, unmet needs, and receptiveness to new formulations.",
      methodology: "Focus Groups",
      targetAudience: "Urban women aged 30-45 who use premium skincare products daily",
      participantCount: 32,
      segments: "4 segments: Beijing tier-1, Shanghai tier-1, by age bracket (30-37, 38-45)",
      timeline: "6 weeks",
      indicativeBudget: 380000,
      currency: "CNY",
      source: "WECHAT",
      serviceModules: {
        create: [
          { moduleType: "RECRUITMENT", quantity: 32, unit: "participants", unitPrice: 900, sortOrder: 0 },
          { moduleType: "MODERATION", quantity: 4, unit: "sessions", unitPrice: 12000, sortOrder: 1 },
          { moduleType: "SIMULTANEOUS_TRANSLATION", quantity: 2, unit: "days", unitPrice: 8000, sortOrder: 2 },
          { moduleType: "VENUE", quantity: 2, unit: "days", unitPrice: 15000, sortOrder: 3 },
          { moduleType: "INCENTIVES", quantity: 32, unit: "participants", unitPrice: 600, sortOrder: 4 },
          { moduleType: "PROJECT_MANAGEMENT", quantity: 8, unit: "days", unitPrice: 2000, sortOrder: 5 },
          { moduleType: "REPORTING", quantity: 5, unit: "days", unitPrice: 5000, sortOrder: 6 },
        ],
      },
    },
  });

  // Estimate
  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber: `EST-${year}-0001`,
      title: "Skincare U&A Study — Estimate",
      projectId: project.id,
      version: 1,
      status: "APPROVED",
      isApproved: true,
      pricingModel: "MIXED",
      currency: "CNY",
      taxRate: 6,
      discount: 0,
      createdById: admin.id,
      phases: {
        create: [
          {
            name: "Recruitment",
            sortOrder: 0,
            lineItems: {
              create: [
                { description: "Participant Recruitment", unit: "participants", quantity: 32, unitPrice: 900, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Fieldwork",
            sortOrder: 1,
            lineItems: {
              create: [
                { description: "Moderation Sessions", unit: "sessions", quantity: 4, unitPrice: 12000, sortOrder: 0 },
                { description: "Simultaneous Translation", unit: "days", quantity: 2, unitPrice: 8000, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Logistics",
            sortOrder: 2,
            lineItems: {
              create: [
                { description: "Venue Hire", unit: "days", quantity: 2, unitPrice: 15000, sortOrder: 0 },
                { description: "Participant Incentives", unit: "participants", quantity: 32, unitPrice: 600, sortOrder: 1 },
              ],
            },
          },
          {
            name: "Reporting",
            sortOrder: 3,
            lineItems: {
              create: [
                { description: "Report Writing", unit: "days", quantity: 5, unitPrice: 5000, sortOrder: 0 },
              ],
            },
          },
          {
            name: "Project Management",
            sortOrder: 4,
            lineItems: {
              create: [
                { description: "Project Management", unit: "days", quantity: 8, unitPrice: 2000, sortOrder: 0 },
              ],
            },
          },
        ],
      },
    },
  });
  console.log("Created estimate:", estimate.title);

  console.log("\nSeed completed successfully!");
  console.log("Login: yushi@ubinsights.com / ubi12345");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
