import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Download } from "lucide-react";
import { useListFiles } from "@workspace/api-client-react";

export default function Files() {
  const { data: filesData, isLoading } = useListFiles();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Exported Files</h1>
            <p className="text-muted-foreground">Download your previously generated reports and exports.</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search files..." className="pl-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
               <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Generated At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filesData && filesData.length > 0 ? (
                    filesData.map((file, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{file.name}</TableCell>
                        <TableCell>{file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'Unknown'}</TableCell>
                        <TableCell>{file.createdAt ? new Date(file.createdAt).toLocaleString() : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No files found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
