import { useState, useEffect, useCallback } from "react";
import type { Company, ContactPerson } from "./contract-types";

interface DbClient {
  id: string;
  company: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  taxId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: DbContact[];
}

interface DbContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  clientId: string;
}

interface DbBusinessProfile {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  tagline: string | null;
}

function mapToCompany(client: DbClient): Company {
  return {
    id: client.id,
    name: client.company,
    industry: client.industry || "",
    address: client.billingAddress || "",
    email: client.email || "",
    phone: client.phone || "",
    taxId: client.taxId || "",
    notes: client.notes || "",
    contacts: client.contacts.map(mapToContact),
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

function mapToContact(contact: DbContact): ContactPerson {
  return {
    id: contact.id,
    name: contact.name,
    title: contact.title || "",
    email: contact.email || "",
    phone: contact.phone || "",
  };
}

function profileToCompany(profile: DbBusinessProfile): Company {
  return {
    id: `bp-${profile.id}`,
    name: profile.name,
    industry: profile.tagline || "",
    address: profile.address || "",
    email: profile.email || "",
    phone: profile.phone || "",
    taxId: "",
    notes: "",
    contacts: [],
    createdAt: "",
    updatedAt: "",
  };
}

export function useClients() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businessProfile, setBusinessProfile] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      const [clientsRes, profileRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/settings/business-profile"),
      ]);
      if (!clientsRes.ok) throw new Error("Failed to fetch clients");
      const data: DbClient[] = await clientsRes.json();
      setCompanies(data.map(mapToCompany));

      if (profileRes.ok) {
        const profile: DbBusinessProfile | null = await profileRes.json();
        if (profile) {
          setBusinessProfile(profileToCompany(profile));
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    companies,
    businessProfile,
    loading,
    error,
    refresh: fetchClients,
  };
}
