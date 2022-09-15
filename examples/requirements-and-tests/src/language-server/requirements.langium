grammar Requirements
import "./common"

entry RequirementModel:
    (contact=Contact)?
    (requirements+=Requirement)*;

Requirement:
    'req' name=ID text=STRING;

