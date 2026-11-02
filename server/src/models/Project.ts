import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const PROJECT_NAME_MAX_LENGTH = 120;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;

export interface ProjectShape {
  owner: Types.ObjectId;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectDocument = HydratedDocument<ProjectShape>;

const projectSchema = new Schema<ProjectShape>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: PROJECT_NAME_MAX_LENGTH,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: PROJECT_DESCRIPTION_MAX_LENGTH,
    },
  },
  { timestamps: true },
);

projectSchema.index({ owner: 1, updatedAt: -1 });

projectSchema.set('toJSON', {
  transform: (_document, value) => {
    const output = value as unknown as Record<string, unknown>;
    delete output.__v;
    return output;
  },
});

export const Project = model<ProjectShape>('Project', projectSchema);

interface ProjectLike {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicProject {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeProject(project: ProjectDocument | ProjectLike): PublicProject {
  return {
    id: project._id.toString(),
    ownerId: project.owner.toString(),
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
