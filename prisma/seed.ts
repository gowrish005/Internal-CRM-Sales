import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.activity.deleteMany();
  await prisma.note.deleteMany();
  await prisma.task.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const hash = async (p: string) => bcrypt.hash(p, 12);

  // Branches
  const mumbai = await prisma.branch.create({ data: { name: "Mumbai HQ", code: "MUM-01", location: "Mumbai, Maharashtra", address: "Bandra Kurla Complex, Mumbai 400051", tags: ["HQ", "Sales"] } });
  const delhi = await prisma.branch.create({ data: { name: "Delhi Office", code: "DEL-01", location: "New Delhi, Delhi", address: "Connaught Place, New Delhi 110001", tags: ["North India"] } });
  const bangalore = await prisma.branch.create({ data: { name: "Bangalore Tech", code: "BLR-01", location: "Bangalore, Karnataka", address: "Koramangala, Bangalore 560034", tags: ["Tech", "R&D"] } });
  const pune = await prisma.branch.create({ data: { name: "Pune Office", code: "PUN-01", location: "Pune, Maharashtra", address: "Hinjewadi, Pune 411057" } });
  const hyderabad = await prisma.branch.create({ data: { name: "Hyderabad Branch", code: "HYD-01", location: "Hyderabad, Telangana", address: "Hitech City, Hyderabad 500081" } });

  // Users
  const admin = await prisma.user.create({
    data: { name: "Rakshak Rao", email: "it@hellcraft.in", password: await hash("admin123"), role: "ADMIN", branchId: mumbai.id },
  });
  const founder1 = await prisma.user.create({
    data: { name: "Arjun Mehta", email: "arjun@hellcraft.in", password: await hash("founder123"), role: "FOUNDER", branchId: mumbai.id },
  });
  const founder2 = await prisma.user.create({
    data: { name: "Priya Sharma", email: "priya@hellcraft.in", password: await hash("founder123"), role: "FOUNDER", branchId: delhi.id },
  });
  const emp1 = await prisma.user.create({
    data: { name: "Rohan Verma", email: "rohan@hellcraft.in", password: await hash("emp123"), role: "EMPLOYEE", branchId: mumbai.id },
  });
  const emp2 = await prisma.user.create({
    data: { name: "Sneha Patel", email: "sneha@hellcraft.in", password: await hash("emp123"), role: "EMPLOYEE", branchId: bangalore.id },
  });

  // Update branch managers
  await prisma.branch.update({ where: { id: mumbai.id }, data: { managerId: founder1.id } });
  await prisma.branch.update({ where: { id: delhi.id }, data: { managerId: founder2.id } });

  // Contacts
  const contacts = await Promise.all([
    prisma.contact.create({ data: { firstName: "Vikram", lastName: "Singh", email: "vikram.singh@techsolutions.com", phone: "+91 98765 43210", designation: "CTO", company: "TechSolutions Pvt Ltd", branchId: mumbai.id, ownerId: founder1.id, leadStatus: "QUALIFIED", leadSource: "REFERRAL", priority: "HIGH", location: "Mumbai", nextFollowUpAt: new Date(Date.now() + 2 * 86400000) } }),
    prisma.contact.create({ data: { firstName: "Meera", lastName: "Krishnan", email: "meera.k@innovate.io", phone: "+91 87654 32109", designation: "VP Operations", company: "Innovate.io", branchId: delhi.id, ownerId: founder2.id, leadStatus: "PROPOSAL", leadSource: "WEBSITE", priority: "HIGH", location: "Delhi", nextFollowUpAt: new Date(Date.now() + 86400000) } }),
    prisma.contact.create({ data: { firstName: "Sanjay", lastName: "Gupta", email: "sanjay@growthventures.in", phone: "+91 76543 21098", designation: "CEO", company: "Growth Ventures", branchId: mumbai.id, ownerId: emp1.id, leadStatus: "CONTACTED", leadSource: "COLD_OUTREACH", priority: "MEDIUM", location: "Mumbai" } }),
    prisma.contact.create({ data: { firstName: "Ananya", lastName: "Reddy", email: "ananya.r@scalespace.com", phone: "+91 65432 10987", designation: "Head of Product", company: "ScaleSpace", branchId: bangalore.id, ownerId: emp2.id, leadStatus: "NEW", leadSource: "EVENT", priority: "MEDIUM", location: "Bangalore" } }),
    prisma.contact.create({ data: { firstName: "Karthik", lastName: "Nair", email: "karthik@futurestack.io", phone: "+91 54321 09876", designation: "Founder", company: "FutureStack", branchId: bangalore.id, ownerId: founder1.id, leadStatus: "NEGOTIATION", leadSource: "REFERRAL", priority: "HIGH", location: "Bangalore", nextFollowUpAt: new Date(Date.now() + 3 * 86400000) } }),
    prisma.contact.create({ data: { firstName: "Divya", lastName: "Malhotra", email: "divya.m@brightedge.co", phone: "+91 43210 98765", designation: "Director Sales", company: "BrightEdge Co", branchId: pune.id, ownerId: emp1.id, leadStatus: "QUALIFIED", leadSource: "SOCIAL_MEDIA", priority: "MEDIUM", location: "Pune" } }),
    prisma.contact.create({ data: { firstName: "Rahul", lastName: "Bose", email: "rahul.b@nexus.in", phone: "+91 32109 87654", designation: "CFO", company: "Nexus Industries", branchId: hyderabad.id, ownerId: emp2.id, leadStatus: "CONTACTED", leadSource: "COLD_OUTREACH", priority: "LOW", location: "Hyderabad" } }),
    prisma.contact.create({ data: { firstName: "Pooja", lastName: "Iyer", email: "pooja.i@digitalwave.com", phone: "+91 21098 76543", designation: "CMO", company: "Digital Wave", branchId: delhi.id, ownerId: founder2.id, leadStatus: "PROPOSAL", leadSource: "REFERRAL", priority: "HIGH", location: "Delhi" } }),
    prisma.contact.create({ data: { firstName: "Amit", lastName: "Joshi", email: "amit.j@horizon.co", phone: "+91 10987 65432", designation: "Head of Engineering", company: "Horizon Tech", branchId: mumbai.id, ownerId: founder1.id, leadStatus: "WON", leadSource: "WEBSITE", priority: "HIGH", location: "Mumbai" } }),
    prisma.contact.create({ data: { firstName: "Nisha", lastName: "Kapoor", email: "nisha.k@sparktech.in", phone: "+91 09876 54321", designation: "Business Dev Manager", company: "SparkTech", branchId: bangalore.id, ownerId: emp2.id, leadStatus: "NEW", leadSource: "EVENT", priority: "LOW", location: "Bangalore" } }),
    prisma.contact.create({ data: { firstName: "Suresh", lastName: "Menon", email: "suresh.m@alphagroup.com", phone: "+91 98901 23456", designation: "Managing Director", company: "Alpha Group", branchId: hyderabad.id, ownerId: founder1.id, leadStatus: "QUALIFIED", leadSource: "REFERRAL", priority: "HIGH", location: "Hyderabad" } }),
    prisma.contact.create({ data: { firstName: "Kavya", lastName: "Rao", email: "kavya.r@greenfield.io", phone: "+91 87890 12345", designation: "COO", company: "Greenfield Solutions", branchId: pune.id, ownerId: emp1.id, leadStatus: "CONTACTED", leadSource: "WEBSITE", priority: "MEDIUM", location: "Pune" } }),
  ]);

  const [vikram, meera, sanjay, ananya, karthik, divya, rahul, pooja, amit, nisha, suresh, kavya] = contacts;

  // Leads
  const leads = await Promise.all([
    prisma.lead.create({ data: { name: "TechSolutions Enterprise Deal", branchId: mumbai.id, contactId: vikram.id, ownerId: founder1.id, source: "REFERRAL", status: "QUALIFIED", priority: "HIGH", estimatedValue: 2500000, expectedCloseAt: new Date(Date.now() + 30 * 86400000), nextFollowUpAt: new Date(Date.now() + 2 * 86400000), lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "Innovate.io Platform License", branchId: delhi.id, contactId: meera.id, ownerId: founder2.id, source: "WEBSITE", status: "PROPOSAL", priority: "HIGH", estimatedValue: 1800000, expectedCloseAt: new Date(Date.now() + 15 * 86400000), nextFollowUpAt: new Date(Date.now() + 86400000), lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "Growth Ventures Consulting", branchId: mumbai.id, contactId: sanjay.id, ownerId: emp1.id, source: "COLD_OUTREACH", status: "CONTACTED", priority: "MEDIUM", estimatedValue: 500000, expectedCloseAt: new Date(Date.now() + 45 * 86400000), lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "FutureStack Integration", branchId: bangalore.id, contactId: karthik.id, ownerId: founder1.id, source: "REFERRAL", status: "NEGOTIATION", priority: "HIGH", estimatedValue: 3200000, expectedCloseAt: new Date(Date.now() + 10 * 86400000), nextFollowUpAt: new Date(Date.now() + 3 * 86400000), lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "BrightEdge Sales Tool", branchId: pune.id, contactId: divya.id, ownerId: emp1.id, source: "SOCIAL_MEDIA", status: "QUALIFIED", priority: "MEDIUM", estimatedValue: 750000, expectedCloseAt: new Date(Date.now() + 25 * 86400000), lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "Digital Wave Marketing Suite", branchId: delhi.id, contactId: pooja.id, ownerId: founder2.id, source: "REFERRAL", status: "PROPOSAL", priority: "HIGH", estimatedValue: 1200000, expectedCloseAt: new Date(Date.now() + 20 * 86400000), lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "Alpha Group ERP", branchId: hyderabad.id, contactId: suresh.id, ownerId: founder1.id, source: "REFERRAL", status: "NEW", priority: "HIGH", estimatedValue: 4500000, lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "Horizon Tech Won Deal", branchId: mumbai.id, contactId: amit.id, ownerId: founder1.id, source: "WEBSITE", status: "WON", priority: "HIGH", estimatedValue: 2000000, lastActivityAt: new Date() } }),
    prisma.lead.create({ data: { name: "Nexus Industries Pilot", branchId: hyderabad.id, contactId: rahul.id, ownerId: emp2.id, source: "COLD_OUTREACH", status: "LOST", priority: "LOW", estimatedValue: 300000, lastActivityAt: new Date() } }),
  ]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Calendar Events
  const event1 = await prisma.calendarEvent.create({
    data: {
      title: "Q3 Strategy Review", type: "MEETING",
      startAt: new Date(today.getTime() + 9 * 3600000),
      endAt: new Date(today.getTime() + 10 * 3600000),
      organizerId: founder1.id, branchId: mumbai.id,
      description: "Quarterly strategy review with leadership",
      participantIds: [founder2.id, admin.id],
    },
  });
  const event2 = await prisma.calendarEvent.create({
    data: {
      title: "TechSolutions Demo Call", type: "CALL",
      startAt: new Date(today.getTime() + 14 * 3600000),
      endAt: new Date(today.getTime() + 14.5 * 3600000),
      organizerId: founder1.id, contactId: vikram.id, branchId: mumbai.id,
      meetingLink: "https://meet.google.com/abc-defg-hij",
      participantIds: [emp1.id],
    },
  });
  const event3 = await prisma.calendarEvent.create({
    data: {
      title: "Innovate.io Proposal Presentation", type: "MEETING",
      startAt: new Date(today.getTime() + 86400000 + 10 * 3600000),
      endAt: new Date(today.getTime() + 86400000 + 11.5 * 3600000),
      organizerId: founder2.id, contactId: meera.id, branchId: delhi.id,
      location: "Delhi Office - Conference Room A",
      participantIds: [admin.id],
    },
  });
  const event4 = await prisma.calendarEvent.create({
    data: {
      title: "FutureStack Negotiation", type: "MEETING",
      startAt: new Date(today.getTime() + 3 * 86400000 + 11 * 3600000),
      endAt: new Date(today.getTime() + 3 * 86400000 + 12 * 3600000),
      organizerId: founder1.id, contactId: karthik.id, branchId: bangalore.id,
      participantIds: [emp2.id],
    },
  });

  // Tasks
  await prisma.task.create({ data: { title: "Send proposal to TechSolutions", ownerId: founder1.id, branchId: mumbai.id, contactId: vikram.id, leadId: leads[0].id, priority: "HIGH", status: "IN_PROGRESS", dueAt: new Date(today.getTime() + 86400000) } });
  await prisma.task.create({ data: { title: "Follow up with Innovate.io", ownerId: founder2.id, branchId: delhi.id, contactId: meera.id, priority: "HIGH", status: "TODO", dueAt: new Date(today.getTime()) } });
  await prisma.task.create({ data: { title: "Prepare Q3 board deck", ownerId: admin.id, priority: "HIGH", status: "IN_PROGRESS", dueAt: new Date(today.getTime() + 5 * 86400000) } });
  await prisma.task.create({ data: { title: "Update CRM with Delhi visit notes", ownerId: emp1.id, branchId: delhi.id, priority: "MEDIUM", status: "TODO", dueAt: new Date(today.getTime() + 2 * 86400000) } });
  await prisma.task.create({ data: { title: "Review FutureStack contract terms", ownerId: founder1.id, branchId: bangalore.id, contactId: karthik.id, leadId: leads[3].id, priority: "HIGH", status: "TODO", dueAt: new Date(today.getTime() + 3 * 86400000) } });
  await prisma.task.create({ data: { title: "Onboarding call with Horizon Tech", ownerId: emp2.id, contactId: amit.id, priority: "MEDIUM", status: "TODO", dueAt: new Date(today.getTime() + 7 * 86400000) } });
  await prisma.task.create({ data: { title: "Send welcome kit to Alpha Group", ownerId: emp1.id, branchId: hyderabad.id, contactId: suresh.id, priority: "MEDIUM", status: "TODO", dueAt: new Date(today.getTime() + 4 * 86400000) } });
  await prisma.task.create({ data: { title: "Monthly team sync agenda", ownerId: admin.id, priority: "LOW", status: "COMPLETED" } });

  // Notes
  await prisma.note.create({ data: { content: "Very interested in our enterprise plan. Wants a custom integration with their existing ERP. Budget approved up to ₹30L.", authorId: founder1.id, contactId: vikram.id } });
  await prisma.note.create({ data: { content: "Decision by end of month. Legal reviewing the contract. Good signs overall.", authorId: founder2.id, contactId: meera.id } });
  await prisma.note.create({ data: { content: "Competitive pricing discussion. They're comparing with 2 other vendors. Need to highlight our support SLA.", authorId: founder1.id, contactId: karthik.id } });

  // Activities
  const activityData = [
    { type: "CONTACT_CREATED" as any, description: `Created contact Vikram Singh`, userId: founder1.id, contactId: vikram.id },
    { type: "CONTACT_CREATED" as any, description: `Created contact Meera Krishnan`, userId: founder2.id, contactId: meera.id },
    { type: "LEAD_CREATED" as any, description: `Created lead: TechSolutions Enterprise Deal`, userId: founder1.id, leadId: leads[0].id },
    { type: "LEAD_STATUS_CHANGED" as any, description: `Moved "TechSolutions Enterprise Deal" from CONTACTED to QUALIFIED`, userId: founder1.id, leadId: leads[0].id },
    { type: "MEETING_CREATED" as any, description: `Scheduled: Q3 Strategy Review`, userId: founder1.id, meetingId: event1.id },
    { type: "NOTE_ADDED" as any, description: `Added a note on Vikram Singh`, userId: founder1.id, contactId: vikram.id },
    { type: "LEAD_CREATED" as any, description: `Created lead: FutureStack Integration`, userId: founder1.id, leadId: leads[3].id },
    { type: "TASK_CREATED" as any, description: `Created task: Send proposal to TechSolutions`, userId: founder1.id },
    { type: "BRANCH_CREATED" as any, description: `Created branch Mumbai HQ`, userId: admin.id, branchId: mumbai.id },
    { type: "CONTACT_UPDATED" as any, description: `Updated contact Karthik Nair`, userId: founder1.id, contactId: karthik.id },
  ];

  for (const a of activityData) {
    await prisma.activity.create({ data: a });
  }

  console.log("✅ Seed complete!");
  console.log("\nLogin credentials:");
  console.log("  Admin:   it@hellcraft.in / admin123");
  console.log("  Founder: arjun@hellcraft.in / founder123");
  console.log("  Founder: priya@hellcraft.in / founder123");
  console.log("  Employee: rohan@hellcraft.in / emp123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
