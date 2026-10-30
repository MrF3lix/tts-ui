import { ExportSelectionProvider } from "./export-selection"

// the selection lives in the layout, so it is kept while moving between pages of the table
export default function SavedLayout({ children }: LayoutProps<"/saved">) {
  return <ExportSelectionProvider>{children}</ExportSelectionProvider>
}
