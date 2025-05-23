export const validateDocumentUpload = (files) => {
  const errors = [];
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!files || files.length === 0) {
    errors.push('No files selected');
  }

  if (files && files.length > 5) {
    errors.push('Maximum 5 files can be uploaded at once');
  }

  if (files) {
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        errors.push(`${file.originalname}: File type not supported. Allowed types: JPG, PNG, GIF, PDF, DOC, DOCX`);
      }
      if (file.size > maxSize) {
        errors.push(`${file.originalname}: File size exceeds 10MB limit`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};