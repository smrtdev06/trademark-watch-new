import { Layout } from "@/components/layout";
import { Image } from "lucide-react";

export default function ImageWatch() {
  return (
    <Layout>
      <div className="mb-4">
        <h4 className="text-xl font-semibold">Image Watch</h4>
      </div>
      <div className="bg-white rounded shadow-sm border p-8 text-center text-gray-500">
        <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p>No image watch results found.</p>
        <p className="text-xs mt-2">Image watch results will appear here once images are imported and processed.</p>
      </div>
    </Layout>
  );
}
