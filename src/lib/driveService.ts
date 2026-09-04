import type { MemoryItem, GoalItem, TaskItem } from '../types';

export interface DriveBackupResult {
  fileId: string;
  name: string;
  webViewLink?: string;
}

export async function uploadAuraBackupToDrive(
  accessToken: string,
  backupData: {
    exportedAt: string;
    userEmail: string;
    memories: MemoryItem[];
    goals: GoalItem[];
    tasks: TaskItem[];
  }
): Promise<DriveBackupResult> {
  const fileName = `AURA_Private_Backup_${new Date().toISOString().split('T')[0]}.json`;
  const fileContent = JSON.stringify(backupData, null, 2);

  // Form multipart upload to Google Drive v3 files endpoint
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'AURA Private AI Memory Layer verified snapshot backup',
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive backup failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return {
    fileId: result.id,
    name: result.name || fileName,
    webViewLink: result.webViewLink,
  };
}

export async function listAuraDriveBackups(accessToken: string): Promise<any[]> {
  const query = "name contains 'AURA_Private_Backup' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,createdTime,webViewLink,size)&orderBy=createdTime desc&pageSize=10`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list Google Drive files: ${response.status}`);
  }

  const data = await response.json();
  return data.files || [];
}
