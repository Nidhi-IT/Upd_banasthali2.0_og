import { z } from "zod";

// Max file size (e.g., 5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Helper for file validation during selection
const fileSelectionSchema = z
  .any()
  .refine((files) => files?.length > 0, "Photo is required.")
  .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
  .refine(
    (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

// Base schema with shared fields
const baseSchema = z.object({
  visitorType: z.enum(["parent", "student"]),
  name: z.string().min(2, "Full Name is required"), // Shared main name field
  submittedAt: z.string().optional(),
  status: z.string().optional(),
  receiptId: z.string().optional(),
});

// Member schema for Parents/Visitors
const memberSchema = z.object({
  name: z.string().min(2, "Member name must be at least 2 characters"),
  // Photo validation happens before submission; here we accept the final processed string or the initial FileList
  photo: z.any()
});

// Schema for when visitorType is 'parent'
const parentSchema = baseSchema.extend({
  visitorType: z.literal("parent"),
  totalPeople: z.number().min(1, "At least 1 person required"),
  males: z.number().min(0),
  females: z.number().min(0),
  // Validate that counts match and at least one member exists
  members: z.array(memberSchema).min(1, "At least one member details required"),
  arrivalDate: z.string().min(1, "Arrival date is required"),
  departureDate: z.string().min(1, "Departure date is required"),
  transportMode: z.string().min(2, "Transport mode required"),
  vehicleNo: z.string().optional(), // Text input, optional
  
  // Student Details whom they are meeting
  hostName: z.string().min(2, "Student name required"),
  hostId: z.string().min(2, "Student ID required"),
  hostCourse: z.string().min(1, "Student course required"),
  hostHostel: z.string().min(1, "Student hostel required"), // <-- ADDED: Hostel validation for Parent Form
}).refine((data) => data.males + data.females === data.totalPeople, {
    message: "Sum of males and females must equal total people",
    path: ["totalPeople"],
});

// Schema for when visitorType is 'student'
const studentSchema = baseSchema.extend({
  visitorType: z.literal("student"),
  // Specific format constraint: e.g., BTBTI23147 (5 letters followed by 5 digits)
  studentId: z.string().regex(/^[A-Z]{5}\d{5}$/, "Invalid format. Must be like BTBTI23147"),
  course: z.string().min(1, "Course selection is required"),
  hostelName: z.string().min(1, "Hostel selection is required"),
  // We use fileSelectionSchema for the form input validation, but allow string for final submission data
  photo: fileSelectionSchema.or(z.string()),
  arrivalDate: z.string().min(1, "Arrival time is required"), // Reusing arrivalDate field for arrival time
  transportMode: z.string().min(2, "Transport mode required"),
  vehicleNo: z.string().optional(), // Text input, optional
});

// Combined schema using discriminated union based on visitorType
export const visitorSchema = z.discriminatedUnion("visitorType", [
  parentSchema,
  studentSchema,
]);