import { Layout } from "@/components/layout";
import { Upload } from "lucide-react";

export default function ImageWatchImport() {
  return (
    <Layout>
      <div className="mb-4">
        <h4 className="text-xl font-semibold">Import Image Watch</h4>
      </div>
      <div className="bg-white rounded shadow-sm border p-6">
        <h5 className="font-semibold text-gray-700 mb-1">Applications file (.XLSX) / Images File (.TXT)</h5>
        <p className="text-sm text-gray-500 mb-4">Upload <b>both</b> files here</p>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <h6 className="text-gray-600">Drop files here or click to upload.</h6>
          <input type="file" accept=".txt,.xlsx" multiple className="text-sm mt-2" />
        </div>
        <div className="text-right mt-3">
          <button className="bg-red-500 text-white px-6 py-2 rounded text-sm hover:bg-red-600">Submit</button>
        </div>
      </div>
    </Layout>
  );
}
