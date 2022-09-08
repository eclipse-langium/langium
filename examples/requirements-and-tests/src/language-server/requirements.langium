grammar Requirements
import "./common"

entry RequirementModel:
    (requirements+=Requirement)*;

Requirement:
    'req' name=ID text=STRING;

