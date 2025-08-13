
import { prisma } from "../lib/prisma.js";
import { type Contact, LinkPrecedence } from "@prisma/client";

export type IdentifyInput = {
  email?: string | null;
  phoneNumber?: string | null;
};

export type IdentifyResponse = {
  contact: {
    primaryContatctId: number; // per spec spelling
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
};

function normalizeEmail(email?: string | null) {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e.length ? e : null;
}

function normalizePhone(p?: string | null) {
  if (!p) return null;
  const s = String(p).trim();
  return s.length ? s : null;
}

async function fetchConnectedContacts(seedEmail: string | null, seedPhone: string | null) {
  let frontierEmails = new Set<string>();
  let frontierPhones = new Set<string>();
  if (seedEmail) frontierEmails.add(seedEmail);
  if (seedPhone) frontierPhones.add(seedPhone);

  const allContacts = new Map<number, Contact>();
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  while (frontierEmails.size || frontierPhones.size) {
    const emailArr = [...frontierEmails];
    const phoneArr = [...frontierPhones];
    frontierEmails.clear();
    frontierPhones.clear();

    const batch = await prisma.contact.findMany({
      where: {
        OR: [
          emailArr.length ? { email: { in: emailArr } } : undefined,
          phoneArr.length ? { phoneNumber: { in: phoneArr } } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const c of batch) {
      if (allContacts.has(c.id)) continue;
      allContacts.set(c.id, c);
      if (c.email && !seenEmails.has(c.email)) {
        frontierEmails.add(c.email);
        seenEmails.add(c.email);
      }
      if (c.phoneNumber && !seenPhones.has(c.phoneNumber)) {
        frontierPhones.add(c.phoneNumber);
        seenPhones.add(c.phoneNumber);
      }
    }
  }

  return [...allContacts.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function identify(input: IdentifyInput): Promise<IdentifyResponse> {
  const email = normalizeEmail(input.email ?? null);
  const phone = normalizePhone(input.phoneNumber ?? null);

  if (!email && !phone) {
    throw new Error("At least one of email or phoneNumber is required");
  }

  let contacts = await fetchConnectedContacts(email, phone);

  // Case 1: No existing contacts - create new primary
  if (contacts.length === 0) {
    const created = await prisma.contact.create({
      data: {
        email,
        phoneNumber: phone,
        linkPrecedence: "primary",
      },
    });
    return {
      contact: {
        primaryContatctId: created.id,
        emails: created.email ? [created.email] : [],
        phoneNumbers: created.phoneNumber ? [created.phoneNumber] : [],
        secondaryContactIds: [],
      },
    };
  }

  // Case 2: Existing contacts found - consolidate cluster
  const primary = contacts[0];
  if (!primary) throw new Error("Primary contact is undefined");

  // Demote any other primaries to secondary
  const otherPrimaries = contacts.filter(
    (c) => c.id !== primary.id && c.linkPrecedence === LinkPrecedence.primary
  );
  if (otherPrimaries.length > 0) {
    await prisma.contact.updateMany({
      where: { id: { in: otherPrimaries.map((c) => c.id) } },
      data: { linkPrecedence: "secondary", linkedId: primary.id },
    });
    
    // Update the contacts array to reflect the changes
    for (const contact of otherPrimaries) {
      contact.linkPrecedence = LinkPrecedence.secondary;
      contact.linkedId = primary.id;
    }
  }

  // Get current cluster data
  const emailsInCluster = new Set(contacts.map((c) => c.email).filter(Boolean) as string[]);
  const phonesInCluster = new Set(contacts.map((c) => c.phoneNumber).filter(Boolean) as string[]);

  // Check if we need to add new information
  const needsNewEmail = email && !emailsInCluster.has(email);
  const needsNewPhone = phone && !phonesInCluster.has(phone);

  console.log('Debug - needsNewEmail:', needsNewEmail, 'needsNewPhone:', needsNewPhone);
  console.log('Debug - input email:', email, 'input phone:', phone);
  console.log('Debug - emailsInCluster:', [...emailsInCluster]);
  console.log('Debug - phonesInCluster:', [...phonesInCluster]);

  // Create secondary contact if we have new information
  if (needsNewEmail || needsNewPhone) {
    const newContact = await prisma.contact.create({
      data: {
        email: needsNewEmail ? email : null,
        phoneNumber: needsNewPhone ? phone : null,
        linkPrecedence: "secondary",
        linkedId: primary.id,
      },
    });
    
    console.log('Debug - created secondary contact:', newContact);
    contacts.push(newContact);
  }

  // Re-fetch the complete cluster to ensure we have all linked contacts
  // This handles cases where the cluster might have expanded
  const completeCluster = await fetchConnectedContacts(
    primary.email || email, 
    primary.phoneNumber || phone
  );

  // Use the complete cluster for final response
  const finalContacts = completeCluster.length > contacts.length ? completeCluster : contacts;

  // Build unique lists
  const uniqueEmails = Array.from(new Set(finalContacts.map((c) => c.email).filter(Boolean) as string[]));
  const uniquePhones = Array.from(new Set(finalContacts.map((c) => c.phoneNumber).filter(Boolean) as string[]));

  // Ensure primary contact's email/phone appears first if it exists
  const emailsList = primary.email && uniqueEmails.includes(primary.email)
    ? [primary.email, ...uniqueEmails.filter((e) => e !== primary.email)]
    : uniqueEmails;
    
  const phonesList = primary.phoneNumber && uniquePhones.includes(primary.phoneNumber)
    ? [primary.phoneNumber, ...uniquePhones.filter((p) => p !== primary.phoneNumber)]
    : uniquePhones;

  const secondaryIds = finalContacts
    .filter((c) => c.linkPrecedence === LinkPrecedence.secondary)
    .map((c) => c.id)
    .sort((a, b) => a - b); // Sort for consistent ordering

  return {
    contact: {
      primaryContatctId: primary.id,
      emails: emailsList,
      phoneNumbers: phonesList,
      secondaryContactIds: secondaryIds,
    },
  };
}