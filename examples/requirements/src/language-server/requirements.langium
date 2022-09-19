grammar Requirements
import "./common"

entry RequirementModel:
    (contact=Contact)?
    (environments+=Environment)*
    (requirements+=Requirement)*;

Environment: 'environment' name=ID ':' description=STRING;

Requirement:
    'req' name=ID text=STRING
    ('applicable' 'for' environments+=[Environment] (',' environments+=[Environment])*)?;

