import { NamedUser } from "@valtimo/config";
import { Collaborator } from "./case-collaborators.model";

export interface CaseChangeLog {
  user: NamedUser;
  timestamp: string;
  message: string;
}