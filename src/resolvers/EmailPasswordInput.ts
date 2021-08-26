import { Field, InputType } from 'type-graphql';

@InputType()
class EmailPasswordInput {
  @Field()
  email: string;

  @Field()
  password: string;
}

export default EmailPasswordInput;
