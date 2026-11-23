export interface Credentials {
  username: string;
  password: string;
}

export interface Registration extends Credentials {
  email: string;
}
