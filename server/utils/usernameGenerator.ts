/**
 * Username generation utility
 * Generates default username from employee name (first initial + lastname, lowercase)
 */

/**
 * Generate a default username from a full name
 * e.g., "Patricia Morrison" -> "pmorrison"
 * e.g., "John Smith Jr." -> "jsmith"
 */
export function generateDefaultUsername(fullName: string): string {
  const cleaned = fullName.trim().toLowerCase();
  const parts = cleaned.split(/\s+/).filter(part => part.length > 0);
  
  if (parts.length === 0) {
    return "";
  }
  
  if (parts.length === 1) {
    return parts[0].replace(/[^a-z0-9]/g, "");
  }
  
  // Get first initial
  const firstInitial = parts[0].charAt(0);
  
  // Get last name (last word, excluding common suffixes)
  const suffixes = ["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"];
  let lastNameIndex = parts.length - 1;
  
  // Skip suffixes
  while (lastNameIndex > 0 && suffixes.includes(parts[lastNameIndex])) {
    lastNameIndex--;
  }
  
  const lastName = parts[lastNameIndex].replace(/[^a-z0-9]/g, "");
  
  return `${firstInitial}${lastName}`;
}

/**
 * Generate a unique username by appending numbers if needed
 */
export function generateUniqueUsername(
  baseName: string,
  existingUsernames: string[]
): string {
  const baseUsername = generateDefaultUsername(baseName);
  
  if (!baseUsername) {
    return "";
  }
  
  // Check if base username is available
  if (!existingUsernames.includes(baseUsername)) {
    return baseUsername;
  }
  
  // Append numbers until unique
  let counter = 1;
  while (existingUsernames.includes(`${baseUsername}${counter}`)) {
    counter++;
  }
  
  return `${baseUsername}${counter}`;
}
