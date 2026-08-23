/* ---------------------------------------------------------
   The parts of the File System Access API that lib/psxFs.ts uses and
   TypeScript's own lib.dom does not describe yet: the folder picker
   and the per-handle permission model. Chrome/Edge only — every call
   site feature-detects before reaching for them.
--------------------------------------------------------- */

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | string;
}

interface Window {
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}
