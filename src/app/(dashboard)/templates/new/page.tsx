import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TemplateBuilder } from "@/components/templates/template-builder";

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Template</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create a reusable estimate template
          </p>
        </div>
      </div>

      <TemplateBuilder mode="create" />
    </div>
  );
}
