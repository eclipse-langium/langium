grammar Tests
import "./common"
import "./requirements"

entry TestModel:
    (tests+=Test)*;

Test:
    'tst' name=ID 
    'tests' requirements+=[Requirement:ID]
    (',' requirements+=[Requirement:ID])*;
